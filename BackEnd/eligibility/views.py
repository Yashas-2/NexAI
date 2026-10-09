"""NexAI - Eligibility API Views"""
from rest_framework import viewsets, views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsHOD, IsStudent
from users.constants import UserRole
from .models import StudentEligibility, HallTicket
from .serializers import (
    StudentEligibilitySerializer, HallTicketSerializer,
    BulkEligibilityUploadSerializer
)
from .tasks import process_eligibility_csv, generate_hall_tickets_for_session
from scheduling.models import ExamSession


from decimal import Decimal

class StudentEligibilityViewSet(viewsets.ModelViewSet):
    """
    HOD can view eligibility records for their department only.
    COE/Admin can see all records.
    Student can only view their own records.
    """
    serializer_class = StudentEligibilitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'student_profile'):
            return StudentEligibility.objects.filter(student=user.student_profile)
        # HOD sees only their department's records
        qs = StudentEligibility.objects.all()
        if user.role == UserRole.HOD and user.department:
            qs = qs.filter(student__department=user.department)
        # COE/Admin sees all records (no department filter)
        session_id = self.request.query_params.get('session_id')
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        # Always deduplicate: keep only the latest record per student+subject
        from django.db.models import Subquery, OuterRef
        latest = StudentEligibility.objects.filter(
            student=OuterRef('student'),
            subject=OuterRef('subject'),
        ).order_by('-created_at').values('id')[:1]
        qs = qs.filter(id__in=Subquery(latest))
        return qs

    def _calculate_eligibility(self, serializer):
        if 'is_eligible' in serializer.validated_data:
            serializer.save()
            return

        instance = serializer.instance
        attendance = serializer.validated_data.get('attendance_percentage')
        if attendance is None and instance:
            attendance = instance.attendance_percentage
        elif attendance is None:
            attendance = Decimal('0')

        # Preserve null vs 0: null = not entered (skip), 0 = explicitly awarded zero (count)
        def get_mark(field):
            val = serializer.validated_data.get(field)
            if val is None and instance:
                val = getattr(instance, field)
            return val

        cie1 = get_mark('cie1_marks')
        cie2 = get_mark('cie2_marks')
        cie3 = get_mark('cie3_marks')
        assignment = get_mark('assignment_marks')

        # Sum only non-null marks (null = not yet entered, 0 = explicitly awarded)
        marks = [m for m in [cie1, cie2, cie3, assignment] if m is not None]
        calculated_cie = sum(marks, Decimal('0'))
        calculated_cie = round(calculated_cie, 2)

        # Eligibility: attendance >= 85%, CIE >= 12/30 (no lab) or >= 20/50 (with lab)
        has_lab = assignment is not None
        cie_threshold = Decimal('20.00') if has_lab else Decimal('12.00')

        is_eligible = True
        remarks = []
        if attendance < Decimal("85.00"):
            is_eligible = False
            remarks.append(f"Shortage of attendance ({attendance}%)")
        if calculated_cie < cie_threshold:
            is_eligible = False
            remarks.append(f"Low CIE marks ({calculated_cie:.2f})")
        serializer.save(
            is_eligible=is_eligible,
            remarks=" | ".join(remarks),
            cie_marks=calculated_cie
        )

    def perform_create(self, serializer):
        self._calculate_eligibility(serializer)

    def perform_update(self, serializer):
        self._calculate_eligibility(serializer)


class HallTicketViewSet(viewsets.ReadOnlyModelViewSet):
    """
    HOD sees only their own department's students' hall tickets.
    CoE / Chief Superintendent sees all.
    Student can only view their own hall ticket.
    """
    serializer_class = HallTicketSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # return ALL tickets — the UI filters client-side

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'student_profile'):
            return HallTicket.objects.filter(
                student=user.student_profile, is_revoked=False
            ).order_by('-created_at')
        qs = HallTicket.objects.all()
        # HOD → own branch only (never other departments' students)
        if getattr(user, 'role', None) == 'HOD':
            dept = getattr(user, 'hod_department', None) or getattr(user, 'department', None)
            if dept:
                qs = qs.filter(student__department=dept)
        session_id = self.request.query_params.get('session_id')
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        return qs.order_by('-created_at')

class BulkEligibilityUploadView(views.APIView):
    """
    Accepts a CSV upload and triggers Celery task.
    HOD can only upload records for their department.
    COE/Admin can upload for any department.
    """
    permission_classes = [IsHOD]

    def post(self, request, *args, **kwargs):
        serializer = BulkEligibilityUploadSerializer(data=request.data)
        if serializer.is_valid():
            file_obj = serializer.validated_data['file']
            session_id = serializer.validated_data.get('exam_session_id')
            
            if not session_id:
                from scheduling.models import ExamSession
                active_session = ExamSession.objects.filter(status='ACTIVE').first() or ExamSession.objects.filter(status__in=['SCHEDULED', 'DRAFT']).first() or ExamSession.objects.first()
                if not active_session:
                    return Response({"error": "No exam session found. Please create an exam session first."}, status=status.HTTP_400_BAD_REQUEST)
                session_id = active_session.id
            
            # Read file content as string
            try:
                file_content = file_obj.read().decode('utf-8')
            except Exception as e:
                return Response({"error": "Failed to read CSV. Ensure it is UTF-8 encoded."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Restrict HOD to their department only
            user = request.user
            dept_id = str(user.department.id) if user.role == UserRole.HOD and user.department else None
            
            from eligibility.tasks import process_eligibility_csv
            result = process_eligibility_csv(file_content, str(session_id), dept_id)
            
            return Response({
                "message": "CSV upload accepted and processed successfully.",
                "result": result
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GenerateHallTicketsView(views.APIView):
    """
    Triggers generation of Hall Tickets for an Exam Session.
    """
    permission_classes = [IsHOD]

    def post(self, request, session_id):
        # Verify session exists
        if not ExamSession.objects.filter(id=session_id).exists():
            return Response({"error": "Exam Session not found."}, status=status.HTTP_404_NOT_FOUND)
            
        result = generate_hall_tickets_for_session(
            session_id,
            department_id=str(request.user.department_id) if request.user.department_id else None,
        )
        if result.get("status") == "error":
            return Response({"error": result.get("message")}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            "message": "Hall ticket generation task queued.",
            "result": result
        }, status=status.HTTP_200_OK)


class GenerateEligibilityView(views.APIView):
    """
    Computes eligibility for all StudentEligibility records for the HOD's department.
    """
    permission_classes = [IsHOD]

    def post(self, request):
        user = request.user
        if not user.department:
            return Response({"error": "No department associated with this HOD."}, status=status.HTTP_400_BAD_REQUEST)
        
        records = StudentEligibility.objects.filter(student__department=user.department)
        
        session_id = request.data.get("session_id")
        if session_id:
            records = records.filter(exam_session_id=session_id)
            
        updated_count = 0
        updated_sessions = set()

        for record in records:
            # Sum only non-null marks (null = not entered, 0 = explicitly awarded)
            marks = [m for m in [record.cie1_marks, record.cie2_marks, record.cie3_marks, record.assignment_marks] if m is not None]
            calculated_cie = sum(marks, Decimal('0'))
            calculated_cie = round(calculated_cie, 2)

            attendance = record.attendance_percentage or Decimal('0')

            # Eligibility: attendance >= 85%, CIE >= 12/30 (no lab) or >= 20/50 (with lab)
            has_lab = record.assignment_marks is not None
            cie_threshold = Decimal('20.00') if has_lab else Decimal('12.00')

            is_eligible = True
            remarks = []
            if attendance < Decimal("85.00"):
                is_eligible = False
                remarks.append(f"Shortage of attendance ({attendance}%)")
            if calculated_cie < cie_threshold:
                is_eligible = False
                remarks.append(f"Low CIE marks ({calculated_cie:.2f})")

            record.is_eligible = is_eligible
            record.remarks = " | ".join(remarks)
            record.cie_marks = calculated_cie
            record.save()
            updated_sessions.add(record.exam_session_id)
            updated_count += 1

        # Notify ineligible students
        from notifications.helpers import notify_user
        ineligible = StudentEligibility.objects.filter(
            student__department=user.department, is_eligible=False
        ).select_related("student__user", "exam_session")
        
        if session_id:
            ineligible = ineligible.filter(exam_session_id=session_id)
            
        for rec in ineligible:
            notify_user(
                rec.student.user,
                "ELIGIBILITY_UPDATE",
                "Eligibility Alert",
                f"You are NOT eligible for {rec.exam_session.name} – {rec.subject.code}. Reason: {rec.remarks}",
                related_object_id=rec.exam_session.id,
            )

        # Auto-activate CIE sessions
        for sid in updated_sessions:
            if sid:
                session = ExamSession.objects.get(id=sid)
                if 'CIE' in session.name.upper():
                    from eligibility.tasks import generate_hall_tickets_for_session
                    generate_hall_tickets_for_session(sid)
                    if session.status != 'ACTIVE':
                        session.status = 'ACTIVE'
                        session.save(update_fields=['status'])

        return Response({
            "message": f"Successfully computed eligibility for {updated_count} records.",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)


class FacultyMarksSyncView(views.APIView):
    """
    Accepts bulk CIE marks and attendance from Faculty Dashboard and updates StudentEligibility records.
    Uses bulk operations for performance.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subject_code = request.data.get("subject_code")
        students_data = request.data.get("students", [])

        if not subject_code or not students_data:
            return Response({"error": "subject_code and students array are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        from scheduling.models import Subject, ExamSession
        from users.models import Student

        try:
            subject = Subject.objects.get(code=subject_code)
        except Subject.DoesNotExist:
            return Response({"error": f"Subject {subject_code} not found."}, status=status.HTTP_404_NOT_FOUND)

        exam_session_id = request.data.get("exam_session_id")
        if exam_session_id:
            try:
                session = ExamSession.objects.get(pk=exam_session_id)
            except ExamSession.DoesNotExist:
                return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            session = ExamSession.objects.filter(status__in=['ACTIVE', 'SCHEDULED', 'DRAFT']).order_by('-created_at').first()
            if not session:
                return Response({"error": "No active exam session found."}, status=status.HTTP_400_BAD_REQUEST)

        # Always sync to the CIE session for this subject, not the SEE session
        cie_session = ExamSession.objects.filter(
            session_type='CIE',
            status__in=['ACTIVE', 'SCHEDULED', 'DRAFT']
        ).order_by('-created_at').first()
        if cie_session:
            session = cie_session

        def parse_decimal(val):
            if val is None or val == '': return None
            return Decimal(str(val))

        # Collect all USNs, batch-fetch students and existing records
        usns = [s_data.get("usn") for s_data in students_data if s_data.get("usn")]
        students_map = {s.usn: s for s in Student.objects.filter(usn__in=usns)}
        existing_records = {
            (r.student_id, r.subject_id): r
            for r in StudentEligibility.objects.filter(
                student__usn__in=usns, subject=subject, exam_session=session
            ).select_related('student')
        }
        student_id_map = {s.usn: s.id for s in students_map.values()}

        records_to_create = []
        records_to_update = []
        updated_count = 0

        for s_data in students_data:
            usn = s_data.get("usn")
            if not usn or usn not in students_map:
                continue

            student = students_map[usn]
            student_id = student.id
            key = (student_id, subject.id)
            record = existing_records.get(key)

            cie1 = parse_decimal(s_data.get("cie1"))
            cie2 = parse_decimal(s_data.get("cie2"))
            cie3 = parse_decimal(s_data.get("cie3"))
            assignment = parse_decimal(s_data.get("labOrProject"))
            attendance = parse_decimal(s_data.get("attendancePercent"))

            marks = [m for m in [cie1, cie2, cie3, assignment] if m is not None]
            calculated_cie = round(sum(marks, Decimal('0')), 2)
            att = attendance or Decimal('0')

            # Eligibility: attendance >= 85%, CIE >= 12/30 (no lab) or >= 20/50 (with lab)
            has_lab = assignment is not None
            cie_threshold = Decimal('20.00') if has_lab else Decimal('12.00')

            is_eligible = True
            remarks = []
            if att < Decimal("85.00"):
                is_eligible = False
                remarks.append(f"Shortage of attendance ({att}%)")
            if calculated_cie < cie_threshold:
                is_eligible = False
                remarks.append(f"Low CIE marks ({calculated_cie:.2f})")

            if record:
                record.attendance_percentage = attendance
                record.cie1_marks = cie1
                record.cie2_marks = cie2
                record.cie3_marks = cie3
                record.assignment_marks = assignment
                record.cie_marks = calculated_cie
                record.is_eligible = is_eligible
                record.remarks = " | ".join(remarks)
                records_to_update.append(record)
            else:
                records_to_create.append(StudentEligibility(
                    student=student,
                    subject=subject,
                    exam_session=session,
                    attendance_percentage=attendance,
                    cie1_marks=cie1,
                    cie2_marks=cie2,
                    cie3_marks=cie3,
                    assignment_marks=assignment,
                    cie_marks=calculated_cie,
                    is_eligible=is_eligible,
                    remarks=" | ".join(remarks),
                ))
            updated_count += 1

        if records_to_create:
            StudentEligibility.objects.bulk_create(
                records_to_create, ignore_conflicts=True, batch_size=50
            )
        if records_to_update:
            # Small batches keep each UPDATE statement well under SQLite's
            # token limits (100-row/8-field CASE updates exceed them).
            StudentEligibility.objects.bulk_update(
                records_to_update,
                ['attendance_percentage', 'cie1_marks', 'cie2_marks', 'cie3_marks',
                 'assignment_marks', 'cie_marks', 'is_eligible', 'remarks'],
                batch_size=25
            )

        return Response({"message": f"Successfully synced marks for {updated_count} students."}, status=status.HTTP_200_OK)
