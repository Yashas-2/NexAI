"""NexAI - Eligibility Serializers"""
from rest_framework import serializers
from .models import StudentEligibility, HallTicket
from users.serializers import StudentSerializer
from scheduling.serializers import SubjectSerializer, ExamSessionSerializer


class StudentEligibilitySerializer(serializers.ModelSerializer):
    student_details = StudentSerializer(source="student", read_only=True)
    subject_details = SubjectSerializer(source="subject", read_only=True)

    usn = serializers.CharField(source='student.usn', read_only=True)
    name = serializers.CharField(source='student.user.full_name', read_only=True)
    email = serializers.CharField(source='student.user.email', read_only=True)
    department = serializers.CharField(source='student.department.name', read_only=True, default='Central Unit')
    department_code = serializers.CharField(source='student.department.code', read_only=True, default='CU')
    semester = serializers.CharField(source='student.current_semester', read_only=True)
    section = serializers.CharField(source='student.section', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_title = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = StudentEligibility
        fields = [
            "id", "student", "subject", "exam_session",
            "student_details", "subject_details",
            "attendance_percentage", 
            "cie1_marks", "cie2_marks", "cie3_marks", "assignment_marks", "cie_marks",
            "is_eligible", "remarks",
            "usn", "name", "email", "department", "department_code", "semester", "section",
            "subject_code", "subject_title",
            "created_at", "updated_at"
        ]
        read_only_fields = ["is_eligible", "remarks", "cie_marks"]


class HallTicketSerializer(serializers.ModelSerializer):
    student_details = StudentSerializer(source="student", read_only=True)
    exam_session_details = ExamSessionSerializer(source="exam_session", read_only=True)

    ticket_number = serializers.CharField(read_only=True)
    usn = serializers.CharField(source='student.usn', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    semester = serializers.CharField(source='student.current_semester', read_only=True)
    department = serializers.CharField(source='student.department.name', read_only=True, default='Central Unit')
    department_code = serializers.CharField(source='student.department.code', read_only=True, default='CU')
    exam_session_name = serializers.CharField(source='exam_session.name', read_only=True)
    schedule = serializers.SerializerMethodField()
    slots = serializers.SerializerMethodField()
    is_cie = serializers.SerializerMethodField()

    class Meta:
        model = HallTicket
        fields = [
            "id", "ticket_number", "student", "exam_session",
            "qr_code_data", "is_revoked",
            "student_details", "exam_session_details",
            "usn", "student_name", "semester", "department", "department_code",
            "exam_session_name", "is_cie",
            "schedule", "slots", "created_at"
        ]
        read_only_fields = ["ticket_number", "qr_code_data", "is_revoked"]

    def get_is_cie(self, obj):
        session_type = getattr(obj.exam_session, 'session_type', None)
        if session_type:
            return session_type == 'CIE'
        return 'CIE' in (obj.exam_session.name or '').upper()

    def get_schedule(self, obj):
        return self._get_schedule_data(obj)

    def get_slots(self, obj):
        return self._get_schedule_data(obj)

    def _get_schedule_data(self, obj):
        from scheduling.models import TimetableSlot, StudentSubjectEnrollment
        from eligibility.models import StudentEligibility

        def _get_scrutiny_id(cie_config):
            """Safely returns the scrutiny ID if it exists and is APPROVED."""
            try:
                s = cie_config.scrutiny
                if s.status == 'APPROVED':
                    return str(s.id)
            except Exception:
                pass
            return None

        # Get the subjects the student is eligible for in this session
        eligible_subjects = list(StudentEligibility.objects.filter(
            student=obj.student,
            exam_session=obj.exam_session,
            is_eligible=True
        ).values_list('subject_id', flat=True))

        # Fallback: eligibility lives in the CIE session, so for SEE sessions
        # resolve each subject from the student's latest eligibility record.
        if not eligible_subjects:
            seen = set()
            latest = StudentEligibility.objects.filter(
                student=obj.student
            ).order_by('-updated_at', '-created_at').values_list('subject_id', 'is_eligible')
            for subject_id, is_eligible in latest:
                if subject_id in seen:
                    continue
                seen.add(subject_id)
                if is_eligible:
                    eligible_subjects.append(subject_id)

        # Fallback: if no eligibility records at all, use enrolled subjects
        if not eligible_subjects:
            enrolled_subjects = StudentSubjectEnrollment.objects.filter(
                student=obj.student,
                exam_session=obj.exam_session,
            ).values_list('subject_id', flat=True)
            eligible_subjects = list(enrolled_subjects)

        slots = TimetableSlot.objects.filter(
            exam_session=obj.exam_session,
            subject_id__in=eligible_subjects,
            status__in=['SCHEDULED', 'CONFIRMED'],
        ).select_related('subject', 'room').order_by(
            'exam_date', 'start_time', 'subject__code', 'room__name'
        )

        # Verified eligibility (any session) — surfaces per-subject status to the UI
        verified_eligible = set(
            StudentEligibility.objects.filter(
                student=obj.student, is_eligible=True
            ).values_list('subject_id', flat=True)
        )

        from vault.models import QuestionPaper
        # Pre-fetch all finalized papers for this session — drafts are still
        # being authored and must never be linked to a student's schedule.
        papers_map = {
            str(p.subject_id): str(p.id) 
            for p in QuestionPaper.objects.filter(
                exam_session=obj.exam_session,
                status__in=['DRAFT', 'SUBMITTED', 'APPROVED', 'ENCRYPTED', 'DISTRIBUTED'],
            )
        }
        
        if 'CIE' in (obj.exam_session.name or '').upper():
            from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
            # Look for ANY CIE config (active or not) that has an APPROVED scrutiny
            cie_configs = CIEConfiguration.objects.filter(
                exam_session=obj.exam_session,
            ).select_related('scrutiny')
            for c in cie_configs:
                try:
                    scrutiny = CIEQuestionPaperScrutiny.objects.filter(
                        cie_config=c,
                        status='APPROVED',
                    ).first()
                    if scrutiny:
                        papers_map[str(c.subject_id)] = str(scrutiny.id)
                except Exception:
                    pass

        data = []
        if slots.exists():
            slot_list = list(slots)
            usn = obj.student.usn
            # Subjects where this student already holds a seat in some hall
            seated_subjects = {
                s.subject_id for s in slot_list if (s.seat_map or {}).get(usn)
            }
            seen_unseated = set()
            for slot in slot_list:
                seat = (slot.seat_map or {}).get(usn)
                if seat is None:
                    # A hall that has seats but not this student's → skip
                    if slot.seat_map:
                        continue
                    # Student is seated in another hall for this subject → skip
                    if slot.subject_id in seated_subjects:
                        continue
                    # Unseated placeholder (seat not allotted yet) — max one row
                    if slot.subject_id in seen_unseated:
                        continue
                    seen_unseated.add(slot.subject_id)
                start = slot.start_time.strftime('%H:%M') if slot.start_time else None
                end = slot.end_time.strftime('%H:%M') if slot.end_time else None
                data.append({
                    "subject_code": slot.subject.code,
                    "subject_name": slot.subject.name,
                    "subject_title": slot.subject.name,
                    "date": slot.exam_date.isoformat() if slot.exam_date else None,
                    "exam_date": slot.exam_date.isoformat() if slot.exam_date else None,
                    "start_time": slot.start_time.isoformat() if slot.start_time else None,
                    "end_time": slot.end_time.isoformat() if slot.end_time else None,
                    "exam_time": f"{start} - {end}" if start and end else None,
                    "room": slot.room.name if slot.room else None,
                    "room_allocated": slot.room.name if slot.room else None,
                    "room_number": slot.room.name if slot.room else None,
                    "seat": seat,
                    "desk_number": seat,
                    "slot_id": str(slot.id),
                    "status": slot.status,
                    "eligible": True if slot.subject_id in verified_eligible else None,
                    "is_cie": obj.exam_session.session_type == 'CIE' if getattr(obj.exam_session, 'session_type', None) else ('CIE' in (obj.exam_session.name or '').upper()),
                    "question_paper_id": papers_map.get(str(slot.subject_id)),
                })
        else:
            # Fallback: show eligible subjects even if no timetable slots exist yet
            # For CIE sessions, read the date/time from CIEConfiguration
            # Dedupe: keep only the latest eligibility record per subject
            eligibilities = []
            seen_subjects = set()
            for elig in (
                StudentEligibility.objects.filter(
                    student=obj.student,
                    exam_session=obj.exam_session,
                    is_eligible=True,
                )
                .select_related('subject')
                .order_by('-updated_at', '-created_at')
            ):
                if elig.subject_id in seen_subjects:
                    continue
                seen_subjects.add(elig.subject_id)
                eligibilities.append(elig)
            
            if eligibilities:
                from cie.models import CIEConfiguration
                for elig in eligibilities:
                    cie_configs = CIEConfiguration.objects.filter(
                        subject=elig.subject,
                        exam_session=obj.exam_session,
                    ).order_by('cie_number')

                    if cie_configs.exists():
                        for cie_config in cie_configs:
                            exam_date = None
                            start_time = None
                            end_time = None
                            exam_time = None

                            if cie_config.scheduled_date:
                                exam_date = cie_config.scheduled_date.isoformat()
                            if cie_config.scheduled_time:
                                start_time = cie_config.scheduled_time.isoformat()
                                from datetime import datetime, timedelta
                                duration = timedelta(minutes=cie_config.duration_mins or 60)
                                end_dt = (datetime.combine(datetime.today(), cie_config.scheduled_time) + duration).time()
                                end_time = end_dt.isoformat()
                                exam_time = (
                                    f"{cie_config.scheduled_time.strftime('%H:%M')} - "
                                    f"{end_dt.strftime('%H:%M')}"
                                )

                            room_name = getattr(cie_config, 'room', None)
                            data.append({
                                "subject_code": elig.subject.code,
                                "subject_name": f"{elig.subject.name} ({cie_config.get_cie_number_display()})",
                                "subject_title": elig.subject.name,
                                "date": exam_date,
                                "exam_date": exam_date,
                                "start_time": start_time,
                                "end_time": end_time,
                                "exam_time": exam_time,
                                "room": room_name,
                                "room_allocated": room_name,
                                "room_number": room_name,
                                "seat": None,
                                "desk_number": None,
                                "slot_id": None,
                                "cie_marks": float(elig.cie_marks) if elig.cie_marks is not None else None,
                                "attendance": float(elig.attendance_percentage) if elig.attendance_percentage is not None else None,
                                "is_cie": True,
                                "eligible": True,
                                "question_paper_id": _get_scrutiny_id(cie_config) or papers_map.get(str(elig.subject_id)),
                            })
                    else:
                        data.append({
                            "subject_code": elig.subject.code,
                            "subject_name": elig.subject.name,
                            "subject_title": elig.subject.name,
                            "date": None,
                            "exam_date": None,
                            "start_time": None,
                            "end_time": None,
                            "exam_time": None,
                            "room": None,
                            "room_allocated": None,
                            "room_number": None,
                            "seat": None,
                            "desk_number": None,
                            "slot_id": None,
                            "cie_marks": float(elig.cie_marks) if elig.cie_marks is not None else None,
                            "attendance": float(elig.attendance_percentage) if elig.attendance_percentage is not None else None,
                            "is_cie": True,
                            "eligible": True,
                            "question_paper_id": papers_map.get(str(elig.subject_id)),
                        })
            else:
                # Fallback of fallback: show enrolled subjects
                enrolled = StudentSubjectEnrollment.objects.filter(
                    student=obj.student,
                    exam_session=obj.exam_session,
                ).select_related('subject')
                # Only show subjects the student is actually eligible for
                if eligible_subjects:
                    enrolled = enrolled.filter(subject_id__in=eligible_subjects)
                for enrollment in enrolled:
                    data.append({
                        "subject_code": enrollment.subject.code,
                        "subject_name": enrollment.subject.name,
                        "subject_title": enrollment.subject.name,
                        "date": None,
                        "exam_date": None,
                        "start_time": None,
                        "end_time": None,
                        "exam_time": None,
                        "room": None,
                        "room_allocated": None,
                        "room_number": None,
                        "seat": None,
                        "desk_number": None,
                        "slot_id": None,
                        "attendance": None,
                        "is_cie": False,
                        "eligible": None,
                        "question_paper_id": papers_map.get(str(enrollment.subject_id)),
                    })
        return data


class BulkEligibilityUploadSerializer(serializers.Serializer):
    """
    Serializer for handling CSV uploads for bulk eligibility data.
    The file should have columns: usn, subject_code, attendance, cie
    """
    file = serializers.FileField()
    exam_session_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        return value
