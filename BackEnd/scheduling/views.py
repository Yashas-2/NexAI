"""NexAI Scheduling – API Views"""
import re

from celery.result import AsyncResult
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsChiefSuperintendent, IsStaff, IsChiefSuperintendentOrHOD
from .models import Subject, Room, ExamSession, TimetableSlot, InvigilationDuty, StudentSubjectEnrollment
from .models import archive_slots, ACTIVE_SLOT_STATUSES
from .serializers import (
    SubjectSerializer,
    RoomSerializer,
    ExamSessionSerializer,
    TimetableSlotSerializer,
    InvigilationDutySerializer,
    TimetableGenerateSerializer,
    StudentSubjectEnrollmentSerializer,
)


# ─── Subject ──────────────────────────────────────────────────────────────────

class SubjectListCreateView(generics.ListCreateAPIView):
    """List all subjects or create a new one. CoE/HOD only for writes."""
    serializer_class = SubjectSerializer
    permission_classes = [IsStaff]
    queryset = Subject.objects.select_related("department").filter(is_active=True)
    filterset_fields = ["semester", "subject_type", "department", "batch_year"]
    search_fields = ["code", "name"]
    ordering_fields = ["semester", "code", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # CoE sees all subjects
        if hasattr(user, 'role') and user.role in ('CHIEF_SUPERINTENDENT', 'COE'):
            return qs
        # HOD sees only their department's subjects
        dept = getattr(user, 'hod_department', getattr(user, 'department', None))
        if dept:
            qs = qs.filter(department=dept)
        return qs

    def perform_create(self, serializer):
        dept = serializer.validated_data.get('department')
        if not dept:
            user = self.request.user
            dept = getattr(user, 'hod_department', getattr(user, 'department', None))
        serializer.save(department=dept)


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or soft-delete a subject."""
    serializer_class = SubjectSerializer
    permission_classes = [IsChiefSuperintendent]
    queryset = Subject.objects.select_related("department")

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class SubjectEnrolledStudentsView(generics.ListAPIView):
    """List all students enrolled in a specific subject."""
    serializer_class = StudentSubjectEnrollmentSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        subject_id = self.kwargs.get("pk")
        qs = StudentSubjectEnrollment.objects.filter(subject_id=subject_id).select_related("student__user", "subject", "exam_session")
        session_id = self.request.query_params.get("exam_session_id")
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        return qs


class SubjectEnrollView(generics.CreateAPIView):
    """Enroll a single student into a subject."""
    serializer_class = StudentSubjectEnrollmentSerializer
    permission_classes = [IsStaff]

    def post(self, request, *args, **kwargs):
        subject_id = self.kwargs.get("pk")
        usn = request.data.get("usn")
        exam_session_id = request.data.get("exam_session_id")

        if not usn:
            return Response({"error": "USN is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        from users.models import Student
        from scheduling.models import ExamSession
        
        try:
            student = Student.objects.get(usn=usn)
        except Student.DoesNotExist:
            return Response(
                {"error": f"Student with USN {usn} is not registered in the system."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Use specified session, or latest DRAFT, or create a default one
        exam_session = None
        if exam_session_id:
            try:
                exam_session = ExamSession.objects.get(id=exam_session_id)
            except ExamSession.DoesNotExist:
                return Response({"error": "Exam session not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            exam_session = ExamSession.objects.filter(status='DRAFT').order_by('-created_at').first()
        
        if not exam_session:
            # Auto-create a default draft session
            from datetime import date
            exam_session = ExamSession.objects.create(
                name='Default Enrollment Session',
                academic_year='2026-27',
                start_date=date.today(),
                end_date=date.today(),
                status='DRAFT'
            )

        # Check if already enrolled
        exists = StudentSubjectEnrollment.objects.filter(
            student=student, subject_id=subject_id, exam_session=exam_session
        ).exists()
        if exists:
            return Response({"error": "Student already enrolled in this subject."}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data.copy()
        data["subject"] = subject_id
        data["student"] = student.id
        data["exam_session"] = exam_session.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class SubjectBatchEnrollView(generics.GenericAPIView):
    """Enroll multiple students into a subject at once."""
    permission_classes = [IsStaff]

    def post(self, request, *args, **kwargs):
        subject_id = self.kwargs.get("pk")
        usns = request.data.get("usns", [])
        exam_session_id = request.data.get("exam_session_id")

        if not usns or not isinstance(usns, list):
            return Response({"error": "usns must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import Student
        from scheduling.models import ExamSession
        from datetime import date

        # Get or create exam session
        exam_session = None
        if exam_session_id:
            try:
                exam_session = ExamSession.objects.get(id=exam_session_id)
            except ExamSession.DoesNotExist:
                return Response({"error": "Exam session not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            exam_session = ExamSession.objects.filter(status='DRAFT').order_by('-created_at').first()

        if not exam_session:
            exam_session = ExamSession.objects.create(
                name='Default Enrollment Session',
                academic_year='2026-27',
                start_date=date.today(),
                end_date=date.today(),
                status='DRAFT'
            )

        enrolled = []
        already_enrolled = []
        not_found = []
        errors = []

        for usn in usns:
            try:
                student = Student.objects.get(usn=usn)
                exists = StudentSubjectEnrollment.objects.filter(
                    student=student, subject_id=subject_id, exam_session=exam_session
                ).exists()
                if exists:
                    already_enrolled.append(usn)
                    continue
                StudentSubjectEnrollment.objects.create(
                    student=student,
                    subject_id=subject_id,
                    exam_session=exam_session,
                )
                enrolled.append(usn)
            except Student.DoesNotExist:
                not_found.append(usn)
            except Exception as e:
                errors.append({"usn": usn, "error": str(e)})

        return Response({
            "enrolled": enrolled,
            "already_enrolled": already_enrolled,
            "not_found": not_found,
            "errors": errors,
            "total_enrolled": len(enrolled),
        }, status=status.HTTP_201_CREATED)


# ─── Room ─────────────────────────────────────────────────────────────────────

class RoomListCreateView(generics.ListCreateAPIView):
    serializer_class = RoomSerializer
    permission_classes = [IsStaff]
    queryset = Room.objects.filter(is_active=True)
    filterset_fields = ["is_lab", "has_wifi", "building"]
    search_fields = ["name", "building"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # CoE sees all rooms
        if hasattr(user, 'role') and user.role in ('CHIEF_SUPERINTENDENT', 'COE'):
            return qs
        # HOD sees only their department's rooms + shared rooms (department=null)
        from django.db import models
        dept = getattr(user, 'hod_department', getattr(user, 'department', None))
        if dept:
            qs = qs.filter(models.Q(department=dept) | models.Q(department__isnull=True))
        return qs

    def perform_create(self, serializer):
        dept = serializer.validated_data.get('department')
        if not dept:
            user = self.request.user
            dept = getattr(user, 'hod_department', getattr(user, 'department', None))
        serializer.save(department=dept)


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RoomSerializer
    permission_classes = [IsChiefSuperintendentOrHOD]
    queryset = Room.objects.all()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


# ─── ExamSession ─────────────────────────────────────────────────────────────

class ExamSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = ExamSessionSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["status", "semester", "academic_year"]

    def get_queryset(self):
        qs = ExamSession.objects.select_related("created_by").prefetch_related("timetable_slots")
        user = self.request.user
        # CoE: only sees SEE sessions
        if hasattr(user, 'role') and user.role in ('CHIEF_SUPERINTENDENT', 'COE'):
            return qs.filter(session_type='SEE')
        
        # HOD: sees ALL SEE sessions AND their own CIE sessions
        from django.db.models import Q
        return qs.filter(Q(session_type='SEE') | Q(session_type='CIE', created_by=user))

    def perform_create(self, serializer):
        user = self.request.user
        # HOD-created sessions are CIE; CoE-created sessions are SEE
        from .models import ExamSession as ES
        stype = ES.SessionType.SEE if hasattr(user, 'role') and user.role in ('CHIEF_SUPERINTENDENT', 'COE') else ES.SessionType.CIE
        serializer.save(created_by=user, session_type=stype)


class ExamSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single ExamSession.
    HODs can only touch their own CIE sessions; CoE can only touch SEE sessions.
    """
    serializer_class = ExamSessionSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = ExamSession.objects.select_related('created_by').prefetch_related('timetable_slots')
        user = self.request.user
        if hasattr(user, 'role') and user.role in ('CHIEF_SUPERINTENDENT', 'COE'):
            return qs.filter(session_type='SEE')
        from django.db.models import Q
        return qs.filter(Q(session_type='SEE') | Q(session_type='CIE', created_by=user))


# ─── Timetable ────────────────────────────────────────────────────────────────

class TimetableSlotListView(generics.ListAPIView):
    """Public read: all staff can view the timetable."""
    serializer_class = TimetableSlotSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["exam_session", "exam_date", "status", "subject", "room"]
    ordering_fields = ["exam_date", "start_time"]

    def get_queryset(self):
        qs = TimetableSlot.objects.select_related(
            "subject", "room", "exam_session"
        ).all()
        # Archived (rescheduled) slots are audit history — hidden by default
        if self.request.query_params.get("include_archived") != "true":
            qs = qs.exclude(status=TimetableSlot.SlotStatus.RESCHEDULED)
        return qs


class TimetableSlotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE individual timetable slot.

    DELETE archives the slot (status -> RESCHEDULED + audit log) instead of
    destroying it, so reschedule history is preserved for audit.
    """
    serializer_class = TimetableSlotSerializer
    permission_classes = [IsChiefSuperintendentOrHOD]
    queryset = TimetableSlot.objects.all()

    def perform_destroy(self, instance):
        archive_slots(
            TimetableSlot.objects.filter(pk=instance.pk),
            reason=self.request.query_params.get("reason", "Slot deleted"),
            user=self.request.user,
        )


@api_view(["POST"])
@permission_classes([IsChiefSuperintendentOrHOD])
def trigger_timetable_generation(request):
    """
    POST /api/v1/scheduling/timetable/generate/

    Runs the OR-Tools CP-SAT solver SYNCHRONOUSLY (no Redis/Celery required).
    Persists TimetableSlots directly and returns the result immediately.
    """
    import uuid
    import traceback
    from .solver import build_schedule_input_from_orm, TimetableSolver

    serializer = TimetableGenerateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    exam_session_id = str(serializer.validated_data["exam_session_id"])
    time_limit = serializer.validated_data["time_limit_secs"]

    try:
        session = ExamSession.objects.get(id=exam_session_id)
    except ExamSession.DoesNotExist:
        return Response({"error": "ExamSession not found"}, status=status.HTTP_404_NOT_FOUND)

    if session.status not in (
        ExamSession.SessionStatus.DRAFT,
        ExamSession.SessionStatus.SCHEDULED,
        ExamSession.SessionStatus.ACTIVE,
    ):
        return Response(
            {"error": f"Cannot generate timetable for session in status '{session.status}'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── CIE Fast-Path ───────────────────────────────────────────────────────
    # CIE sessions don't use the OR-Tools solver; allocate seats from
    # CIEConfiguration scheduled date/time + StudentEligibility records.
    is_cie_session = 'CIE' in session.name.upper()
    if is_cie_session:
        from cie.models import CIEConfiguration
        from eligibility.models import StudentEligibility
        from scheduling.models import Room
        import uuid as _uuid
        from django.db import transaction

        # Get all CIE configs for this session
        cie_configs = CIEConfiguration.objects.filter(
            exam_session=session
        ).select_related('subject')

        if not cie_configs.exists():
            return Response(
                {"error": "No CIE configurations found for this session. Create CIE configurations first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get available rooms
        dept_codes = session.departments or []
        if not dept_codes and session.created_by:
            creator_dept = getattr(session.created_by, 'department', None)
            if creator_dept:
                dept_codes = [creator_dept.code]

        from django.db.models import Q as _Q
        if dept_codes:
            rooms_qs = Room.objects.filter(
                is_active=True
            ).filter(
                _Q(department__code__in=dept_codes) | _Q(department__isnull=True)
            ).order_by('-exam_capacity')
        else:
            rooms_qs = Room.objects.filter(is_active=True).order_by('-exam_capacity')

        rooms = list(rooms_qs)
        if not rooms:
            return Response(
                {"error": "No active rooms found. Create rooms for your department first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seat_data = []
        total_allocated = 0

        with transaction.atomic():
            # Archive old CIE slots for this session (kept for audit, hidden from students)
            archive_slots(
                TimetableSlot.objects.filter(
                    exam_session=session,
                    status=TimetableSlot.SlotStatus.SCHEDULED,
                ),
                reason="CIE schedule regenerated",
                user=request.user if request.user.is_authenticated else None,
            )

            from users.models import User
            from scheduling.models import InvigilationDuty, InvigilatorSessionKey
            import random

            invigilators = list(User.objects.filter(role__in=["INVIGILATOR", "HOD", "EVALUATOR"]).order_by('?'))
            invigilator_idx = 0

            slots_to_create = []
            duties_to_create = []
            keys_to_create = []
            
            # Helper to generate a random 12-char key
            def _generate_session_key():
                return f"CIE-{_uuid.uuid4().hex[:4].upper()}-{_uuid.uuid4().hex[:4].upper()}"

            from datetime import datetime as _dt, timedelta as _td

            _used_slot_times = {}  # (room_id, date) -> set of used start_times

            for cie_config in cie_configs:
                subj = cie_config.subject
                exam_date = cie_config.scheduled_date
                start_time = cie_config.scheduled_time
                end_time = None
                if start_time:
                    duration = _td(minutes=cie_config.duration_mins or 60)
                    end_time = (_dt.combine(_dt.today(), start_time) + duration).time()

                # Eligible students for this subject
                eligibilities = StudentEligibility.objects.filter(
                    exam_session=session,
                    subject=subj,
                    is_eligible=True,
                ).select_related('student')

                students_to_allocate = []
                
                if eligibilities.exists():
                    students_to_allocate = list({e.student.id: e.student for e in eligibilities}.values())
                else:
                    # For CIE, fallback to all enrolled students if no eligibility data exists
                    from scheduling.models import StudentSubjectEnrollment
                    enrollments = StudentSubjectEnrollment.objects.filter(
                        exam_session=session,
                        subject=subj,
                    ).select_related('student')
                    students_to_allocate = list({e.student.id: e.student for e in enrollments}.values())

                if not students_to_allocate:
                    continue

                # Room chunking logic
                student_idx = 0
                room_idx = 0
                
                while student_idx < len(students_to_allocate):
                    # Find next available room that is not occupied at this specific date and time
                    room = None
                    initial_room_idx = room_idx
                    while True:
                        candidate_room = rooms[room_idx % len(rooms)]
                        room_idx += 1
                        
                        slot_key = (candidate_room.id, exam_date)
                        if slot_key not in _used_slot_times or start_time not in _used_slot_times[slot_key]:
                            room = candidate_room
                            break
                        
                        # Stop if we've cycled through all rooms
                        if (room_idx - initial_room_idx) >= len(rooms):
                            break
                    
                    if not room:
                        # Genuine failure to accommodate all students at this exact time slot
                        return Response(
                            {"error": f"Not enough room capacity to allocate all students for {subj.code} at the strict scheduled time of {start_time}. Do not change the slot timings automatically. Please add more eligible rooms or reduce eligible students."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    
                    capacity = room.exam_capacity
                    chunk = students_to_allocate[student_idx : student_idx + capacity]
                    student_idx += capacity
                    
                    seat_map = {}
                    for i, student in enumerate(chunk):
                        row = (i // 6) + 1
                        col = (i % 6) + 1
                        seat_map[student.usn] = f"R{row}-S{col}"

                    slot_start = start_time
                    slot_end = end_time
                    
                    _used_slot_times.setdefault((room.id, exam_date), set()).add(slot_start)

                    slot = TimetableSlot(
                        id=_uuid.uuid4(),
                        exam_session=session,
                        subject=subj,
                        room=room,
                        exam_date=exam_date,
                        start_time=slot_start,
                        end_time=slot_end,
                        status=TimetableSlot.SlotStatus.SCHEDULED,
                        seat_map=seat_map,
                        solver_score=0,
                    )
                    slots_to_create.append(slot)
                    
                    # Create InvigilationDuty and SessionKey
                    if invigilators:
                        inv = invigilators[invigilator_idx % len(invigilators)]
                        invigilator_idx += 1
                        
                        duty = InvigilationDuty(
                            id=_uuid.uuid4(),
                            timetable_slot=slot,
                            invigilator=inv,
                            duty_role=InvigilationDuty.DutyRole.CHIEF
                        )
                        duties_to_create.append(duty)
                        
                        key = InvigilatorSessionKey(
                            id=_uuid.uuid4(),
                            duty=duty,
                            session_key=_generate_session_key(),
                            is_active=False
                        )
                        keys_to_create.append(key)

                    seat_data.append({
                        "subject_code": subj.code,
                        "subject_name": subj.name,
                        "room_name": room.name,
                        "room_capacity": room.exam_capacity,
                        "seat_map": seat_map,
                        "exam_date": exam_date.isoformat() if exam_date else None,
                        "start_time": start_time.isoformat() if start_time else None,
                        "end_time": end_time.isoformat() if end_time else None,
                    })
                    total_allocated += len(seat_map)

            if slots_to_create:
                TimetableSlot.objects.bulk_create(slots_to_create)
            if duties_to_create:
                InvigilationDuty.objects.bulk_create(duties_to_create, ignore_conflicts=True)
            if keys_to_create:
                InvigilatorSessionKey.objects.bulk_create(keys_to_create, ignore_conflicts=True)

            # Update session status from DRAFT to SCHEDULED
            if total_allocated > 0 and session.status == ExamSession.SessionStatus.DRAFT:
                session.status = ExamSession.SessionStatus.SCHEDULED
                session.save(update_fields=['status'])

        if total_allocated == 0:
            return Response(
                {"error": "No students found for this CIE session. Ensure students are enrolled in the subjects first."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        fake_task_id = f"cie-{_uuid.uuid4().hex[:8]}"
        return Response({
            "success": True,
            "task_id": fake_task_id,
            "sync": True,
            "ready": True,
            "message": f"CIE seating allocated for '{session.name}' – {total_allocated} students across {len(seat_data)} subjects.",
            "result": {
                "success": True,
                "slots_created": len(seat_data),
                "solver_status": "CIE_FAST_PATH",
                "wall_time_secs": 0,
                "objective_value": total_allocated,
            },
            "seat_data": seat_data,
        }, status=status.HTTP_202_ACCEPTED)
    # ── End CIE Fast-Path ──────────────────────────────────────────────────

    # ── SEE Fast-Path ──────────────────────────────────────────────────────
    # SEE sessions don't use the OR-Tools solver either (it deadlocks on
    # Python 3.13). Allocate eligible students for each enrolled subject
    # across the session window: up to `exams_per_day` papers per day,
    # with rooms, seat maps, invigilation duties and session keys.
    if session.session_type == ExamSession.SessionType.SEE or (
        'SEE' in session.name.upper() and session.session_type != ExamSession.SessionType.CIE
    ):
        import uuid as _uuid
        from datetime import time as _time, timedelta as _td
        from django.db import transaction
        from django.db.models import Q as _Q
        from django.utils.timezone import localdate
        from eligibility.models import StudentEligibility
        from users.models import User
        from .models import InvigilationDuty as _Duty, InvigilatorSessionKey as _Key
        from .models import Room as _Room
        # NOTE: bind locally — other branches import these names into the
        # enclosing function scope, so an unimported name is unbound here.
        from .models import StudentSubjectEnrollment  # noqa: F811

        dept_codes = session.departments or []
        rooms_filter = _Q(department__isnull=True)
        if dept_codes:
            rooms_filter = _Q(department__code__in=dept_codes) | _Q(department__isnull=True)
        rooms_qs = _Room.objects.filter(is_active=True).filter(rooms_filter)
        if session.selected_rooms:
            rooms_qs = rooms_qs.filter(name__in=session.selected_rooms)
        rooms = list(rooms_qs.order_by('-exam_capacity'))
        if not rooms:
            return Response(
                {"error": "No active rooms found for this session's departments. Create rooms first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Subjects students are enrolled in for this session
        enrolled_subject_ids = set(
            StudentSubjectEnrollment.objects.filter(exam_session=session)
            .values_list('subject_id', flat=True)
        )
        subjects = list(
            Subject.objects.filter(id__in=enrolled_subject_ids, is_active=True).order_by('code')
        )
        if not subjects:
            return Response(
                {"error": "No enrolled subjects found for this session. Enroll students first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def _students_for(subj):
            """Latest eligible students across sessions (eligibility usually
            lives on the CIE session), falling back to session enrollments."""
            latest = {}
            for e in (
                StudentEligibility.objects.filter(subject=subj, is_eligible=True)
                .order_by('-updated_at', '-created_at')
                .select_related('student')
            ):
                if e.student_id not in latest:
                    latest[e.student_id] = e.student
            if latest:
                return list(latest.values())
            seen = {}
            for e in (
                StudentSubjectEnrollment.objects.filter(exam_session=session, subject=subj)
                .select_related('student')
            ):
                seen[e.student_id] = e.student
            return list(seen.values())

        # Build the list of exam days (never schedule in the past)
        today = localdate()
        window_start = session.start_date or today
        if window_start < today:
            window_start = today
        exam_dates = []
        d = window_start
        while d <= (session.end_date or window_start):
            exam_dates.append(d)
            d += _td(days=1)
        if not exam_dates:
            return Response(
                {"error": "Session window has no future days left. Extend end_date on the session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        per_day = max(1, min(2, session.exams_per_day or 1))
        day_starts = [_time(9, 0), _time(14, 0)][:per_day]

        invigilators = list(
            User.objects.filter(role__in=["INVIGILATOR", "HOD", "EVALUATOR"]).order_by('?')
        )

        def _session_key():
            return f"SEE-{_uuid.uuid4().hex[:4].upper()}-{_uuid.uuid4().hex[:4].upper()}"

        seat_data = []
        total_allocated = 0
        slots_to_create = []
        duties_to_create = []
        keys_to_create = []
        used = set()  # (room_id, date, start_time) -> booked

        with transaction.atomic():
            archive_slots(
                TimetableSlot.objects.filter(
                    exam_session=session,
                    status__in=list(ACTIVE_SLOT_STATUSES),
                ),
                reason="SEE schedule regenerated",
                user=request.user if request.user.is_authenticated else None,
            )

            for i, subj in enumerate(subjects):
                day_idx = i // per_day
                start_time = day_starts[i % per_day]
                exam_date = exam_dates[day_idx % len(exam_dates)]
                duration = getattr(subj, 'exam_duration_mins', None) or 180
                from datetime import datetime as _dt
                end_time = (_dt.combine(_dt.today(), start_time) + _td(minutes=duration)).time()

                students_to_allocate = _students_for(subj)
                if not students_to_allocate:
                    continue

                # Chunk students into rooms free at (room, date, start_time)
                student_idx = 0
                room_scan = 0
                while student_idx < len(students_to_allocate):
                    room = None
                    for _ in range(len(rooms)):
                        candidate = rooms[room_scan % len(rooms)]
                        room_scan += 1
                        if (candidate.id, exam_date, start_time) not in used:
                            room = candidate
                            break
                    if not room:
                        return Response(
                            {"error": f"No free room for {subj.code} on {exam_date} at {start_time}. "
                                      f"Add more rooms or reduce exams_per_day."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    chunk = students_to_allocate[student_idx : student_idx + room.exam_capacity]
                    student_idx += room.exam_capacity

                    seat_map = {}
                    for j, student in enumerate(chunk):
                        seat_map[student.usn] = f"R{(j // 6) + 1}-S{(j % 6) + 1}"

                    used.add((room.id, exam_date, start_time))

                    slot = TimetableSlot(
                        id=_uuid.uuid4(),
                        exam_session=session,
                        subject=subj,
                        room=room,
                        exam_date=exam_date,
                        start_time=start_time,
                        end_time=end_time,
                        status=TimetableSlot.SlotStatus.SCHEDULED,
                        seat_map=seat_map,
                        solver_score=0,
                    )
                    slots_to_create.append(slot)

                    if invigilators:
                        inv = invigilators[sum(len(s.seat_map) for s in slots_to_create) % len(invigilators)]
                        duty = _Duty(
                            id=_uuid.uuid4(),
                            timetable_slot=slot,
                            invigilator=inv,
                            duty_role=_Duty.DutyRole.CHIEF,
                        )
                        duties_to_create.append(duty)
                        keys_to_create.append(
                            _Key(
                                id=_uuid.uuid4(),
                                duty=duty,
                                session_key=_session_key(),
                                is_active=False,
                            )
                        )

                    seat_data.append({
                        "subject_code": subj.code,
                        "subject_name": subj.name,
                        "room_name": room.name,
                        "room_capacity": room.exam_capacity,
                        "seat_map": seat_map,
                        "exam_date": exam_date.isoformat(),
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                    })
                    total_allocated += len(seat_map)

            if slots_to_create:
                TimetableSlot.objects.bulk_create(slots_to_create)
            if duties_to_create:
                _Duty.objects.bulk_create(duties_to_create, ignore_conflicts=True)
            if keys_to_create:
                _Key.objects.bulk_create(keys_to_create, ignore_conflicts=True)

        if total_allocated == 0:
            return Response(
                {"error": "No students found to allocate for this SEE session. "
                          "Ensure students are enrolled (and eligible) first."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return Response({
            "success": True,
            "task_id": f"see-{_uuid.uuid4().hex[:8]}",
            "sync": True,
            "ready": True,
            "message": f"SEE schedule for '{session.name}' – {total_allocated} seats across {len(seat_data)} subjects.",
            "result": {
                "success": True,
                "slots_created": len(seat_data),
                "solver_status": "SEE_FAST_PATH",
                "wall_time_secs": 0,
                "objective_value": total_allocated,
            },
            "seat_data": seat_data,
        }, status=status.HTTP_202_ACCEPTED)
    # ── End SEE Fast-Path ──────────────────────────────────────────────────

    try:
        schedule_input = build_schedule_input_from_orm(exam_session_id)

        if not schedule_input.subjects:
            return Response(
                {"error": "No subjects found for this session. Link subjects to the session first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not schedule_input.rooms:
            return Response(
                {"error": "No active rooms found for this department. Create rooms for your department first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not schedule_input.time_slots:
            return Response(
                {"error": "No time slots generated. Ensure start_date <= end_date on the session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        solver = TimetableSolver(schedule_input, time_limit_secs=time_limit)
        result = solver.solve()

        if not result.success:
            return Response(
                {"error": result.error, "solver_status": result.solver_status},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        from django.db import transaction
        with transaction.atomic():
            archive_slots(
                TimetableSlot.objects.filter(
                    exam_session_id=exam_session_id,
                    status=TimetableSlot.SlotStatus.SCHEDULED,
                ),
                reason="Timetable regenerated by solver",
                user=request.user if request.user.is_authenticated else None,
            )

            slots_to_create = [
                TimetableSlot(
                    exam_session_id=exam_session_id,
                    subject_id=a.subject_id,
                    room_id=a.room_id,
                    exam_date=a.time_slot.exam_date,
                    start_time=a.time_slot.start_time,
                    end_time=a.time_slot.end_time,
                    status=TimetableSlot.SlotStatus.SCHEDULED,
                    solver_score=result.objective_value,
                )
                for a in result.assignments
            ]
            TimetableSlot.objects.bulk_create(slots_to_create, ignore_conflicts=True)

            saved_slots = TimetableSlot.objects.filter(
                exam_session_id=exam_session_id,
                status=TimetableSlot.SlotStatus.SCHEDULED,
            ).select_related("subject")

            inv_map = {a.subject_id: a.invigilator_id for a in result.assignments if a.invigilator_id}
            duties = [
                InvigilationDuty(
                    timetable_slot=slot,
                    invigilator_id=inv_map[str(slot.subject_id)],
                    duty_role=InvigilationDuty.DutyRole.CHIEF,
                )
                for slot in saved_slots
                if str(slot.subject_id) in inv_map
            ]
            if duties:
                InvigilationDuty.objects.bulk_create(duties, ignore_conflicts=True)

            # Generate seat allocations for each slot
            from eligibility.models import StudentEligibility
            from scheduling.models import StudentSubjectEnrollment
            for slot in saved_slots:
                # First try to get eligible students from StudentEligibility
                eligibilities = StudentEligibility.objects.filter(
                    exam_session_id=exam_session_id,
                    subject_id=slot.subject_id,
                    is_eligible=True
                ).select_related('student')
                
                seat_map = {}
                
                if eligibilities.exists():
                    # Use eligibility records
                    for i, elig in enumerate(eligibilities):
                        row = (i // 6) + 1
                        col = (i % 6) + 1
                        seat_map[elig.student.usn] = f"R{row}-S{col}"
                else:
                    # Fallback: use enrolled students for this subject
                    enrollments = StudentSubjectEnrollment.objects.filter(
                        subject=slot.subject,
                        exam_session=slot.exam_session
                    ).select_related('student')
                    
                    for i, enroll in enumerate(enrollments):
                        row = (i // 6) + 1
                        col = (i % 6) + 1
                        seat_map[enroll.student.usn] = f"R{row}-S{col}"
                
                slot.seat_map = seat_map
            
            TimetableSlot.objects.bulk_update(saved_slots, ['seat_map'])

            fake_task_id = f"sync-{uuid.uuid4().hex[:8]}"
            session.status = ExamSession.SessionStatus.SCHEDULED
            session.scheduling_task_id = fake_task_id
            session.save(update_fields=["status", "scheduling_task_id"])

        # Build seat map data for response
        seat_data = []
        for slot in saved_slots:
            seat_data.append({
                "subject_code": slot.subject.code,
                "subject_name": slot.subject.name,
                "room_name": slot.room.name if slot.room else "Unassigned",
                "room_capacity": slot.room.exam_capacity if slot.room else 0,
                "seat_map": slot.seat_map or {},
                "exam_date": slot.exam_date.isoformat() if slot.exam_date else None,
                "start_time": slot.start_time.isoformat() if slot.start_time else None,
                "end_time": slot.end_time.isoformat() if slot.end_time else None,
            })

        return Response(
            {
                "success": True,
                "task_id": fake_task_id,
                "sync": True,
                "ready": True,
                "message": f"Timetable generated for '{session.name}' in {round(result.wall_time_secs, 2)}s.",
                "result": {
                    "success": True,
                    "slots_created": len(slots_to_create),
                    "solver_status": result.solver_status,
                    "wall_time_secs": round(result.wall_time_secs, 3),
                    "objective_value": result.objective_value,
                },
                "seat_data": seat_data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        return Response(
            {"error": str(exc), "detail": traceback.format_exc()},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsChiefSuperintendentOrHOD])
def seating_blueprint(request):
    """
    GET /api/v1/scheduling/seating-blueprint/?exam_session=<uuid>&room=<uuid>
    Returns the full seating blueprint with real student data.
    """
    exam_session_id = request.query_params.get("exam_session")
    room_id = request.query_params.get("room")

    if not exam_session_id:
        return Response({"error": "exam_session parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    from eligibility.models import StudentEligibility, HallTicket
    from users.models import Student

    # Get all timetable slots for this session
    slots_qs = TimetableSlot.objects.filter(
        exam_session_id=exam_session_id
    ).select_related("subject", "room")

    if room_id:
        slots_qs = slots_qs.filter(room_id=room_id)

    # Build seating data per room
    rooms_data = {}
    for slot in slots_qs:
        room_name = slot.room.name if slot.room else "Unassigned"
        if room_name not in rooms_data:
            rooms_data[room_name] = {
                "room_name": room_name,
                "room_id": str(slot.room.id) if slot.room else None,
                "capacity": slot.room.exam_capacity if slot.room else 0,
                "subjects": [],
                "seats": [],
            }

        subject_info = {
            "subject_code": slot.subject.code,
            "subject_name": slot.subject.name,
        }
        rooms_data[room_name]["subjects"].append(subject_info)

        # Get students assigned to this slot via seat_map
        seat_map = slot.seat_map or {}
        for usn, seat_label in seat_map.items():
            try:
                student = Student.objects.select_related('user', 'department').get(usn=usn)
                rooms_data[room_name]["seats"].append({
                    "usn": usn,
                    "student_name": student.user.full_name,
                    "semester": student.current_semester,
                    "department": student.department.name if student.department else "Unknown",
                    "subject_code": slot.subject.code,
                    "subject_name": slot.subject.name,
                    "seat": seat_label,
                    "slot_id": str(slot.id),
                })
            except Student.DoesNotExist:
                rooms_data[room_name]["seats"].append({
                    "usn": usn,
                    "student_name": f"Student ({usn})",
                    "semester": None,
                    "department": "Unknown",
                    "subject_code": slot.subject.code,
                    "subject_name": slot.subject.name,
                    "seat": seat_label,
                    "slot_id": str(slot.id),
                })

    return Response({
        "exam_session_id": exam_session_id,
        "rooms": list(rooms_data.values()),
    })
@api_view(["GET"])
@permission_classes([IsChiefSuperintendentOrHOD])
def timetable_task_status(request, task_id: str):
    """
    GET /api/v1/scheduling/timetable/status/<task_id>/
    Poll the status of a running OR-Tools Celery task.
    """
    task_result = AsyncResult(task_id)
    return Response(
        {
            "task_id": task_id,
            "status": task_result.status,
            "ready": task_result.ready(),
            "result": task_result.result if task_result.ready() else None,
        }
    )


# ─── Invigilation ─────────────────────────────────────────────────────────────

class InvigilationDutyListCreateView(generics.ListCreateAPIView):
    serializer_class = InvigilationDutySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["timetable_slot", "timetable_slot__exam_session", "invigilator", "duty_role"]

    def get_queryset(self):
        qs = InvigilationDuty.objects.select_related(
            "invigilator", "timetable_slot__subject", "timetable_slot__room"
        )
        if self.request.query_params.get('include_archived') != 'true':
            qs = qs.exclude(timetable_slot__status=TimetableSlot.SlotStatus.RESCHEDULED)
        if self.request.query_params.get('my_duties') == 'true':
            qs = qs.filter(invigilator=self.request.user)
        return qs


def _eligible_students_for(subject, session):
    """Latest eligible students for a subject (eligibility records often live
    on a different session, e.g. CIE), falling back to session enrollments."""
    from eligibility.models import StudentEligibility
    latest = {}
    for e in (
        StudentEligibility.objects.filter(subject=subject, is_eligible=True)
        .order_by('-updated_at', '-created_at')
        .select_related('student')
    ):
        if e.student_id not in latest:
            latest[e.student_id] = e.student
    if latest:
        return list(latest.values())
    seen = {}
    for e in StudentSubjectEnrollment.objects.filter(
        exam_session=session, subject=subject
    ).select_related('student'):
        seen[e.student_id] = e.student
    return list(seen.values())


def _assign_seats_for_empty_slots(session, slot_ids=None):
    """
    Distribute a subject's eligible students across its active slots that have
    no seat map (e.g. slots saved by the COE allocation wizard), filling rooms
    in date/time/room order. Returns the number of slots seated.
    """
    import itertools
    qs = TimetableSlot.objects.filter(
        exam_session=session,
        status__in=ACTIVE_SLOT_STATUSES,
        seat_map={},
    ).select_related('room', 'subject')
    if slot_ids is not None:
        qs = qs.filter(id__in=slot_ids)
    qs = qs.order_by('subject_id', 'exam_date', 'start_time', '-room__exam_capacity', 'room__name')

    seated = 0
    for _subject_id, group in itertools.groupby(qs, key=lambda s: s.subject_id):
        slots = list(group)
        students = _eligible_students_for(slots[0].subject, session)
        if not students:
            continue
        idx = 0
        for slot in slots:
            if idx >= len(students):
                break
            capacity = slot.room.exam_capacity or len(students)
            chunk = students[idx : idx + capacity]
            if not chunk:
                break
            idx += capacity
            seat_map = {}
            for j, student in enumerate(chunk):
                seat_map[student.usn] = f"R{(j // 6) + 1}-S{(j % 6) + 1}"
            slot.seat_map = seat_map
            slot.save(update_fields=['seat_map'])
            seated += 1
    return seated


def _parse_clock(value):
    """Parse 'HH:MM[:SS]' (or a datetime.time) into datetime.time, else None."""
    from datetime import time as _clock
    if isinstance(value, _clock):
        return value
    try:
        return _clock.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


class AllocationSaveView(generics.GenericAPIView):
    """Save AI allocation results: creates TimetableSlots and InvigilationDuties."""
    permission_classes = [IsChiefSuperintendentOrHOD]

    def post(self, request, *args, **kwargs):
        from datetime import datetime, timedelta, date

        exam_session_id = request.data.get("exam_session_id")
        allocations = request.data.get("allocations", [])

        if not exam_session_id:
            return Response({"error": "exam_session_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exam_session = ExamSession.objects.get(id=exam_session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Exam session not found."}, status=status.HTTP_404_NOT_FOUND)

        created_slots = 0
        updated_slots = 0
        created_duties = 0
        archived_slots = 0
        touched_slot_ids = []
        errors = []
        warnings = []

        # ── Reschedule handling: archive (never delete) slots that are no
        # longer part of the desired timetable; unchanged slots are reused.
        desired_keys = set()
        for alloc in allocations:
            desired_keys.add((
                alloc.get("subject_code"),
                alloc.get("room_name"),
                str(alloc.get("exam_date")),
                str(alloc.get("start_time")),
            ))

        existing_slots = TimetableSlot.objects.filter(
            exam_session=exam_session
        ).select_related("subject", "room")

        stale_slot_ids = []
        for slot in existing_slots:
            key = (
                slot.subject.code,
                slot.room.name,
                slot.exam_date.isoformat(),
                slot.start_time.isoformat(),
            )
            if key not in desired_keys:
                stale_slot_ids.append(slot.id)

        if stale_slot_ids:
            archived_slots = archive_slots(
                TimetableSlot.objects.filter(id__in=stale_slot_ids),
                reason="Removed from allocation / rescheduled",
                user=request.user,
            )

        for alloc in allocations:
            subject_code = alloc.get("subject_code")
            room_name = alloc.get("room_name")
            exam_date = alloc.get("exam_date")
            start_time = alloc.get("start_time")
            end_time = alloc.get("end_time")
            chief_email = alloc.get("chief_invigilator_email")
            reliever_email = alloc.get("reliever_invigilator_email")

            try:
                subject = Subject.objects.get(code=subject_code)
                room = Room.objects.get(name=room_name)
            except (Subject.DoesNotExist, Room.DoesNotExist) as e:
                errors.append(f"Subject {subject_code} or Room {room_name} not found: {str(e)}")
                continue

            # Guard: end must be after start — derive a sane duration when the
            # wizard sends an inverted or missing end time.
            start_t = _parse_clock(start_time)
            end_t = _parse_clock(end_time)
            if start_t and (end_t is None or end_t <= start_t):
                duration = getattr(subject, 'exam_duration_mins', None) or 180
                end_dt = datetime.combine(date(2000, 1, 1), start_t) + timedelta(minutes=duration)
                end_time = end_dt.time().isoformat()
                warnings.append(
                    f"{subject_code}: end time was missing or before start — "
                    f"set to {end_time} ({duration} min exam)."
                )

            # Reuse an existing active slot, or create it (archived slots are
            # never revived — they are history).
            slot = TimetableSlot.objects.filter(
                exam_session=exam_session,
                subject=subject,
                room=room,
                exam_date=exam_date,
                start_time=start_time,
                status__in=ACTIVE_SLOT_STATUSES,
            ).first()
            if slot:
                touched_slot_ids.append(slot.id)
                needs_save = (
                    slot.status != TimetableSlot.SlotStatus.CONFIRMED
                    or slot.end_time.strftime("%H:%M") != str(end_time)[:5]
                )
                if needs_save:
                    slot.end_time = end_time
                    slot.status = TimetableSlot.SlotStatus.CONFIRMED
                    slot.save(update_fields=["end_time", "status"])
                    updated_slots += 1
            else:
                slot = TimetableSlot.objects.create(
                    exam_session=exam_session,
                    subject=subject,
                    room=room,
                    exam_date=exam_date,
                    start_time=start_time,
                    end_time=end_time,
                    status=TimetableSlot.SlotStatus.CONFIRMED,
                )
                created_slots += 1
                touched_slot_ids.append(slot.id)

            # Create Chief InvigilationDuty
            if chief_email:
                from users.models import User as UserModel
                try:
                    chief = UserModel.objects.get(email=chief_email)
                    InvigilationDuty.objects.get_or_create(
                        timetable_slot=slot,
                        invigilator=chief,
                        defaults={"duty_role": "CHIEF"}
                    )
                    created_duties += 1
                except UserModel.DoesNotExist:
                    errors.append(f"Chief invigilator {chief_email} not found")

            # Create Reliever InvigilationDuty
            if reliever_email:
                from users.models import User as UserModel
                try:
                    reliever = UserModel.objects.get(email=reliever_email)
                    InvigilationDuty.objects.get_or_create(
                        timetable_slot=slot,
                        invigilator=reliever,
                        defaults={"duty_role": "RELIEF"}
                    )
                    created_duties += 1
                except UserModel.DoesNotExist:
                    errors.append(f"Reliever invigilator {reliever_email} not found")

        # Wizard allocations carry no seat data — seat the students now so
        # the student app sees one room/seat per subject (not every hall).
        seated_slots = _assign_seats_for_empty_slots(
            exam_session, slot_ids=touched_slot_ids
        )

        if not errors:
            exam_session.status = ExamSession.SessionStatus.SCHEDULED
            exam_session.save()

        return Response({
            "created_slots": created_slots,
            "updated_slots": updated_slots,
            "archived_slots": archived_slots,
            "created_duties": created_duties,
            "seated_slots": seated_slots,
            "warnings": warnings,
            "errors": errors,
            "message": (
                f"Saved {created_slots} timetable slots ({updated_slots} updated, "
                f"{archived_slots} archived) and {created_duties} invigilation duties "
                f"({seated_slots} slots seated)."
            ),
        }, status=status.HTTP_201_CREATED)


from rest_framework.views import APIView
from .models import InvigilatorSessionKey, StudentExamAttendance, ExamIncidentReport
from .serializers import InvigilatorSessionKeySerializer

# Hall-ticket QR payload contract (see eligibility/tasks.py):
#   qr_code_data = f"{student.usn}-{exam_session.id}"
_QR_PAYLOAD_RE = re.compile(
    r"^(?P<usn>[A-Za-z0-9]+)-"
    r"(?P<session>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$"
)
# Invigilators may open/refresh the session this many minutes before start /
# after end (early hall setup, overrun, testing) instead of only in-window.
_SESSION_OPEN_GRACE_MINUTES = 120


def _load_key_or_error(code):
    """Resolve an active session key, or return an error Response."""
    try:
        key_obj = InvigilatorSessionKey.objects.select_related(
            "duty__timetable_slot__subject",
            "duty__timetable_slot__room",
            "duty__timetable_slot__exam_session",
            "duty__invigilator",
        ).get(session_key=code)
    except InvigilatorSessionKey.DoesNotExist:
        return None, Response({"error": "Invalid session key."}, status=status.HTTP_404_NOT_FOUND)
    if not key_obj.is_active:
        return None, Response({"error": "This session key has been deactivated."}, status=status.HTTP_400_BAD_REQUEST)
    return key_obj, None


def _seat_usn_from_map(seat_map, usn):
    """Canonical seat-map key for a (possibly lower-case) USN, else None."""
    usn = (usn or "").strip()
    if not usn:
        return None
    if usn in seat_map:
        return usn
    upper = usn.upper()
    for key in seat_map:
        if key.upper() == upper:
            return key
    return None


def _seat_labels(seat_code):
    """'R1-S2' -> ('R1-S2', 'Row 1, Seat 2'); passthrough otherwise."""
    seat_code = str(seat_code or "")
    m = re.match(r"^R(\d+)-S(\d+)$", seat_code)
    if m:
        return seat_code, f"Row {m.group(1)}, Seat {m.group(2)}"
    return seat_code, seat_code


def _initials(name):
    parts = [p for p in (name or "").split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "ST"


def _attendance_for(slot, usns):
    """usn -> StudentExamAttendance for the given slot (bulk)."""
    if not usns:
        return {}
    return {
        att.student.usn: att
        for att in StudentExamAttendance.objects.filter(
            timetable_slot=slot, student__usn__in=usns
        ).select_related("student")
    }


def _build_session_payload(key_obj):
    """
    Full exam-session payload for the invigilator app: session header +
    candidate roster (Name/USN/Subject/Seat/Room/Attendance) from the slot's
    seat map + persisted attendance, + incident log + counters. Shared by the
    Seating Blueprint and Candidate Roster tabs (single source of truth).
    """
    from django.utils import timezone

    slot = key_obj.duty.timetable_slot
    seat_map = slot.seat_map or {}

    roster = {}
    if seat_map:
        from users.models import Student
        roster = {s.usn: s for s in Student.objects.filter(
            usn__in=seat_map.keys()
        ).select_related("user")}
    att_by_usn = _attendance_for(slot, seat_map.keys())

    students = []
    for usn, seat in seat_map.items():
        student = roster.get(usn)
        att = att_by_usn.get(usn)
        name = student.full_name if student else usn
        desk, pos = _seat_labels(seat)
        students.append({
            "deskId": desk,
            "usn": usn,
            "studentName": name,
            "courseCode": slot.subject.code,
            "seatPosition": pos,
            "isQrVerified": bool(att and att.is_qr_verified),
            "isBiometricMatched": bool(att and att.is_biometric_matched),
            "status": att.status if att else StudentExamAttendance.AttendanceStatus.UNVERIFIED,
            "bookletBarcode": att.booklet_barcode if att else None,
            "dummyBarcode": att.dummy_barcode if att else None,
            "avatarInitials": _initials(name),
            "digitizedPagesCount": att.digitized_pages_count if att else 0,
        })
    students.sort(key=lambda s: s["deskId"])

    incidents = []
    for inc in slot.incidents.select_related("student").order_by("-timestamp"):
        desk, _ = _seat_labels(seat_map.get(inc.student.usn, ""))
        incidents.append({
            "id": str(inc.id),
            "deskId": desk,
            "studentUsn": inc.student.usn,
            "studentName": inc.student.full_name,
            "infractionType": inc.infraction_type,
            "description": inc.description,
            "timestamp": timezone.localtime(inc.timestamp).strftime("%d %b %Y, %H:%M"),
            "isBroadcastedToCoE": inc.is_broadcasted_to_coe,
        })

    def _count(status):
        return sum(1 for s in students if s["status"] == status)

    return {
        "sessionId": str(slot.id),
        "exam_session_id": str(slot.exam_session_id) if slot.exam_session_id else None,
        "examSessionName": slot.exam_session.name if slot.exam_session else None,
        "hallNumber": slot.room.name if slot.room else "TBA",
        "courseCode": slot.subject.code,
        "courseTitle": slot.subject.name,
        "examDate": slot.exam_date.isoformat() if slot.exam_date else None,
        "timeSlot": (
            f"{slot.start_time.strftime('%H:%M') if slot.start_time else 'TBA'}"
            f" - {slot.end_time.strftime('%H:%M') if slot.end_time else 'TBA'}"
        ),
        "chiefInvigilatorName": key_obj.duty.invigilator.full_name,
        "dutyRole": key_obj.duty.duty_role,
        "students": students,
        "incidents": incidents,
        "counts": {
            "total": len(students),
            "present": _count(StudentExamAttendance.AttendanceStatus.PRESENT),
            "absent": _count(StudentExamAttendance.AttendanceStatus.ABSENT),
            "malpractice": _count(StudentExamAttendance.AttendanceStatus.MALPRACTICE),
            "unverified": _count(StudentExamAttendance.AttendanceStatus.UNVERIFIED),
            "booklets": sum(1 for s in students if s["bookletBarcode"]),
        },
    }


class InvigilatorSessionKeyView(APIView):
    """
    GET /scheduling/invigilator-keys/?duty_id=<id>
    POST /scheduling/invigilator-keys/
    """
    permission_classes = [IsStaff]

    def get(self, request):
        duty_id = request.query_params.get("duty_id")
        if duty_id:
            keys = InvigilatorSessionKey.objects.filter(duty_id=duty_id)
        else:
            keys = InvigilatorSessionKey.objects.all()
            
        serializer = InvigilatorSessionKeySerializer(keys, many=True)
        return Response(serializer.data)

    def post(self, request):
        duty_id = request.data.get("duty_id")
        if not duty_id:
            return Response({"error": "duty_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            duty = InvigilationDuty.objects.get(id=duty_id)
        except InvigilationDuty.DoesNotExist:
            return Response({"error": "InvigilationDuty not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if a key already exists for this duty
        existing = InvigilatorSessionKey.objects.filter(duty=duty).first()
        if existing:
            serializer = InvigilatorSessionKeySerializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        import string
        from django.utils.crypto import get_random_string
        
        while True:
            code = get_random_string(length=6, allowed_chars=string.ascii_uppercase + string.digits)
            if not InvigilatorSessionKey.objects.filter(session_key=code).exists():
                break

        key_obj = InvigilatorSessionKey.objects.create(
            duty=duty,
            session_key=code,
            is_active=True
        )

        serializer = InvigilatorSessionKeySerializer(key_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class InvigilatorSessionKeyActivateView(APIView):
    """
    POST /scheduling/invigilator-keys/activate/
    Activates an invigilation session using a 6-digit code and returns the
    full session payload: header, candidate roster (seat/attendance),
    incident log and counters. Validates a grace window around the slot.
    """
    permission_classes = [IsStaff]

    def post(self, request):
        from datetime import timedelta as _td

        from django.utils import timezone

        code = request.data.get("session_code") or request.data.get("session_key")
        if not code:
            return Response({"error": "session_key is required."}, status=status.HTTP_400_BAD_REQUEST)

        key_obj, error = _load_key_or_error(code)
        if error is not None:
            return error

        slot = key_obj.duty.timetable_slot

        # Time window with grace: open from N minutes before start until N
        # minutes after end (early hall setup / overrun / testing).
        now = timezone.now()
        if slot.exam_date and slot.start_time and slot.end_time:
            from datetime import datetime as _dt

            slot_start = _dt.combine(slot.exam_date, slot.start_time)
            slot_end = _dt.combine(slot.exam_date, slot.end_time)
            
            if slot_end < slot_start:
                slot_end += _td(days=1)
                
            if timezone.is_naive(slot_start):
                slot_start = timezone.make_aware(slot_start)
            if timezone.is_naive(slot_end):
                slot_end = timezone.make_aware(slot_end)
            grace = _td(minutes=_SESSION_OPEN_GRACE_MINUTES)

            if now < slot_start - grace:
                return Response({
                    "error": (
                        f"This exam session starts at {slot.start_time.strftime('%H:%M')} "
                        f"on {slot.exam_date.isoformat()}. The hall opens "
                        f"{_SESSION_OPEN_GRACE_MINUTES} minutes before start."
                    ),
                    "exam_date": slot.exam_date.isoformat(),
                    "start_time": slot.start_time.isoformat(),
                }, status=status.HTTP_400_BAD_REQUEST)
            if now > slot_end + grace:
                return Response({
                    "error": "This exam session has ended.",
                    "exam_date": slot.exam_date.isoformat(),
                    "end_time": slot.end_time.isoformat(),
                }, status=status.HTTP_400_BAD_REQUEST)

        if key_obj.activated_at is None:
            key_obj.activated_at = now
            key_obj.save(update_fields=["activated_at"])

        response_data = _build_session_payload(key_obj)
        seat_map = slot.seat_map or {}
        response_data.update({
            "assigned_students": list(seat_map.keys()),
            "subject_code": slot.subject.code,
            "subject_name": slot.subject.name,
            "room_name": slot.room.name if slot.room else "TBA",
            "exam_date": slot.exam_date.isoformat() if slot.exam_date else None,
            "exam_time": (
                f"{slot.start_time.strftime('%H:%M') if slot.start_time else 'TBA'}"
                f" - {slot.end_time.strftime('%H:%M') if slot.end_time else 'TBA'}"
            ),
            "total_students": len(seat_map),
        })
        return Response(response_data, status=status.HTTP_200_OK)


class MarkAttendanceView(APIView):
    """
    POST /scheduling/invigilator/mark-attendance/
    Marks attendance for a student in the session's hall.

    Body: session_key, usn, optional qr_payload ("{usn}-{exam_session_id}"
    hall-ticket contract), optional status (present|absent|malpractice).

    Validates the QR payload against the session + hall ticket, enforces the
    seat allocation, and is duplicate-safe (re-scan reports already_marked).
    """
    permission_classes = [IsStaff]

    def post(self, request):
        from users.models import Student

        code = request.data.get("session_key")
        usn = (request.data.get("usn") or "").strip()
        qr_payload = (request.data.get("qr_payload") or "").strip()
        status_val = (request.data.get("status") or "present").strip().lower()

        if not code or not usn:
            return Response({"error": "session_key and usn are required."}, status=status.HTTP_400_BAD_REQUEST)
        if status_val not in ("present", "absent", "malpractice"):
            return Response({"error": "status must be present, absent or malpractice."}, status=status.HTTP_400_BAD_REQUEST)

        key_obj, error = _load_key_or_error(code)
        if error is not None:
            return error

        slot = key_obj.duty.timetable_slot
        seat_map = slot.seat_map or {}

        # ── Hall-ticket QR contract: {usn}-{exam_session_id} ──
        if qr_payload:
            m = _QR_PAYLOAD_RE.match(qr_payload)
            if not m:
                return Response({
                    "error": "QR code is not a valid hall-ticket payload.",
                    "qr_valid": False,
                }, status=status.HTTP_400_BAD_REQUEST)
            if m.group("usn").upper() != usn.upper():
                return Response({
                    "error": "QR code does not match this candidate's USN.",
                    "qr_valid": False,
                }, status=status.HTTP_400_BAD_REQUEST)
            qr_session = m.group("session").lower()
            if slot.exam_session_id and qr_session != str(slot.exam_session_id).lower():
                return Response({
                    "error": (
                        "QR code belongs to a different exam session "
                        f"({qr_session}); this hall is writing "
                        f"{slot.exam_session_id}."
                    ),
                    "qr_valid": False,
                }, status=status.HTTP_400_BAD_REQUEST)

        seat_usn = _seat_usn_from_map(seat_map, usn)
        if seat_usn is None:
            return Response({
                "error": "Student is not assigned to this exam hall.",
                "qr_valid": False,
            }, status=status.HTTP_400_BAD_REQUEST)

        if qr_payload:
            from eligibility.models import HallTicket

            ticket = HallTicket.objects.filter(
                student__usn=seat_usn,
                exam_session_id=slot.exam_session_id,
                is_revoked=False,
            ).first()
            if ticket is None:
                return Response({
                    "error": "No valid (non-revoked) hall ticket for this exam session.",
                    "qr_valid": False,
                }, status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.get(usn=seat_usn)
        except Student.DoesNotExist:
            return Response({"error": f"No student found with USN {seat_usn}."}, status=status.HTTP_404_NOT_FOUND)

        seat = str(seat_map.get(seat_usn) or "")
        desk, pos = _seat_labels(seat)

        att, created = StudentExamAttendance.objects.get_or_create(
            timetable_slot=slot,
            student=student,
            defaults={
                "desk_id": desk[:20],
                "seat_position": pos[:20],
                "status": status_val,
                "is_qr_verified": bool(qr_payload),
                "is_biometric_matched": bool(request.data.get("is_biometric_matched", False)),
            },
        )

        already_marked = False
        if not created:
            qr_now = att.is_qr_verified or bool(qr_payload)
            unchanged = (
                att.status == status_val
                and qr_now == att.is_qr_verified
                and att.desk_id == desk[:20]
            )
            if unchanged:
                already_marked = True
            else:
                att.status = status_val
                att.is_qr_verified = qr_now
                att.desk_id = desk[:20]
                att.seat_position = pos[:20]
                att.save(update_fields=[
                    "status", "is_qr_verified", "desk_id", "seat_position", "updated_at",
                ])

        return Response({
            "message": (
                f"Attendance already marked ({att.status.upper()})"
                if already_marked
                else "Attendance marked successfully"
            ),
            "usn": seat_usn,
            "student_name": student.full_name,
            "seat": desk,
            "seat_position": pos,
            "status": att.status.upper(),
            "already_marked": already_marked,
            "qr_valid": bool(qr_payload),
        }, status=status.HTTP_200_OK)


class InvigilatorIncidentView(APIView):
    """
    POST /scheduling/invigilator/incident/
    Body: session_key, usn, infraction_type, description (optional).
    Persists an ExamIncidentReport for the slot and flags the candidate's
    attendance as malpractice.
    """
    permission_classes = [IsStaff]

    def post(self, request):
        from django.utils import timezone
        from users.models import Student

        code = request.data.get("session_key")
        usn = (request.data.get("usn") or "").strip()
        infraction_type = (request.data.get("infraction_type") or "").strip()
        description = (request.data.get("description") or "").strip()

        if not code or not usn or not infraction_type:
            return Response(
                {"error": "session_key, usn and infraction_type are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        key_obj, error = _load_key_or_error(code)
        if error is not None:
            return error

        slot = key_obj.duty.timetable_slot
        seat_map = slot.seat_map or {}
        seat_usn = _seat_usn_from_map(seat_map, usn)
        if seat_usn is None:
            return Response({"error": "Student is not assigned to this exam hall."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.get(usn=seat_usn)
        except Student.DoesNotExist:
            return Response({"error": f"No student found with USN {seat_usn}."}, status=status.HTTP_404_NOT_FOUND)

        desk, pos = _seat_labels(seat_map.get(seat_usn, ""))
        incident = ExamIncidentReport.objects.create(
            timetable_slot=slot,
            student=student,
            reported_by=request.user,
            infraction_type=infraction_type,
            description=description or f"Candidate flagged for {infraction_type}.",
            is_broadcasted_to_coe=True,
        )
        StudentExamAttendance.objects.update_or_create(
            timetable_slot=slot,
            student=student,
            defaults={
                "desk_id": desk[:20],
                "seat_position": pos[:20],
                "status": StudentExamAttendance.AttendanceStatus.MALPRACTICE,
            },
        )

        return Response({
            "id": str(incident.id),
            "deskId": desk,
            "studentUsn": seat_usn,
            "studentName": student.full_name,
            "infractionType": incident.infraction_type,
            "description": incident.description,
            "timestamp": timezone.localtime(incident.timestamp).strftime("%d %b %Y, %H:%M"),
            "isBroadcastedToCoE": incident.is_broadcasted_to_coe,
        }, status=status.HTTP_201_CREATED)


class InvigilatorBookletView(APIView):
    """
    POST /scheduling/invigilator/booklet/
    Body: session_key, usn, booklet_barcode, dummy_barcode (optional).
    Tags the collected answer booklet onto the candidate's attendance record.
    """
    permission_classes = [IsStaff]

    def post(self, request):
        from users.models import Student

        code = request.data.get("session_key")
        usn = (request.data.get("usn") or "").strip()
        barcode = (request.data.get("booklet_barcode") or "").strip()
        dummy = (request.data.get("dummy_barcode") or "").strip()

        if not code or not usn or not barcode:
            return Response(
                {"error": "session_key, usn and booklet_barcode are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        key_obj, error = _load_key_or_error(code)
        if error is not None:
            return error

        slot = key_obj.duty.timetable_slot
        seat_map = slot.seat_map or {}
        seat_usn = _seat_usn_from_map(seat_map, usn)
        if seat_usn is None:
            return Response({"error": "Student is not assigned to this exam hall."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.get(usn=seat_usn)
        except Student.DoesNotExist:
            return Response({"error": f"No student found with USN {seat_usn}."}, status=status.HTTP_404_NOT_FOUND)

        att = StudentExamAttendance.objects.filter(timetable_slot=slot, student=student).first()
        if att is None:
            return Response(
                {"error": "Mark the candidate present before collecting a booklet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if att.booklet_barcode and att.booklet_barcode != barcode:
            return Response(
                {
                    "error": f"A booklet ({att.booklet_barcode}) is already tagged for this candidate.",
                    "booklet": {
                        "booklet_barcode": att.booklet_barcode,
                        "dummy_barcode": att.dummy_barcode,
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )

        already_tagged = att.booklet_barcode == barcode
        if not already_tagged:
            att.booklet_barcode = barcode
            if dummy:
                att.dummy_barcode = dummy
            att.save(update_fields=["booklet_barcode", "dummy_barcode", "updated_at"])

        return Response({
            "usn": seat_usn,
            "student_name": student.full_name,
            "booklet_barcode": att.booklet_barcode,
            "dummy_barcode": att.dummy_barcode,
            "already_tagged": already_tagged,
        }, status=status.HTTP_200_OK)
