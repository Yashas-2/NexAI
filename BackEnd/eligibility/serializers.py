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
        return 'CIE' in (obj.exam_session.name or '').upper()

    def get_schedule(self, obj):
        return self._get_schedule_data(obj)

    def get_slots(self, obj):
        return self._get_schedule_data(obj)

    def _get_schedule_data(self, obj):
        from scheduling.models import TimetableSlot, StudentSubjectEnrollment
        from eligibility.models import StudentEligibility

        # Get the subjects the student is eligible for in this session
        eligible_subjects = StudentEligibility.objects.filter(
            student=obj.student,
            exam_session=obj.exam_session,
            is_eligible=True
        ).values_list('subject_id', flat=True)

        # Fallback: if no eligibility records, use enrolled subjects
        if not eligible_subjects:
            enrolled_subjects = StudentSubjectEnrollment.objects.filter(
                student=obj.student,
                exam_session=obj.exam_session,
            ).values_list('subject_id', flat=True)
            eligible_subjects = enrolled_subjects

        slots = TimetableSlot.objects.filter(
            exam_session=obj.exam_session,
            subject_id__in=eligible_subjects,
            status__in=['SCHEDULED', 'CONFIRMED']
        ).select_related('subject', 'room')

        from vault.models import QuestionPaper
        # Pre-fetch all papers for this session
        papers_map = {
            p.subject_id: str(p.id) 
            for p in QuestionPaper.objects.filter(exam_session=obj.exam_session)
        }

        data = []
        if slots.exists():
            for slot in slots:
                seat = (slot.seat_map or {}).get(obj.student.usn)
                # Only include slots where this student is actually assigned
                if seat is None and slot.seat_map:
                    continue
                seat = seat or "Unassigned"
                data.append({
                    "subject_code": slot.subject.code,
                    "subject_name": slot.subject.name,
                    "subject_title": slot.subject.name,
                    "date": slot.exam_date.isoformat() if slot.exam_date else None,
                    "exam_date": slot.exam_date.isoformat() if slot.exam_date else None,
                    "start_time": slot.start_time.isoformat() if slot.start_time else None,
                    "end_time": slot.end_time.isoformat() if slot.end_time else None,
                    "exam_time": f"{slot.start_time.strftime('%H:%M') if slot.start_time else 'TBA'} - {slot.end_time.strftime('%H:%M') if slot.end_time else 'TBA'}",
                    "room": slot.room.name if slot.room else "TBA",
                    "room_allocated": slot.room.name if slot.room else "TBA",
                    "room_number": slot.room.name if slot.room else "TBA",
                    "seat": seat,
                    "desk_number": seat,
                    "slot_id": str(slot.id),
                    "question_paper_id": papers_map.get(slot.subject_id),
                })
        else:
            # Fallback: show eligible subjects even if no timetable slots exist yet
            # For CIE sessions, read the date/time from CIEConfiguration
            eligibilities = StudentEligibility.objects.filter(
                student=obj.student,
                exam_session=obj.exam_session,
                is_eligible=True
            ).select_related('subject')
            
            if eligibilities.exists():
                from cie.models import CIEConfiguration
                for elig in eligibilities:
                    # Try to get the CIE configuration for scheduled date/time
                    # Look for the first active/existing config for this subject
                    cie_config = CIEConfiguration.objects.filter(
                        subject=elig.subject,
                        exam_session=obj.exam_session,
                    ).order_by('cie_number').first()

                    exam_date = None
                    start_time = None
                    end_time = None
                    exam_time = 'TBA'
                    if cie_config:
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

                    data.append({
                        "subject_code": elig.subject.code,
                        "subject_name": elig.subject.name,
                        "subject_title": elig.subject.name,
                        "date": exam_date,
                        "exam_date": exam_date,
                        "start_time": start_time,
                        "end_time": end_time,
                        "exam_time": exam_time,
                        "room": cie_config and getattr(cie_config, 'room', None) or 'TBA',
                        "room_allocated": 'TBA',
                        "room_number": 'TBA',
                        "seat": 'Unassigned',
                        "desk_number": 'Unassigned',
                        "slot_id": None,
                        "cie_marks": str(elig.cie_marks) if elig.cie_marks else 'N/A',
                        "attendance": str(elig.attendance_percentage) if elig.attendance_percentage else 'N/A',
                        "is_cie": True,
                        "question_paper_id": papers_map.get(elig.subject_id),
                    })
            else:
                # Fallback of fallback: show enrolled subjects
                enrolled = StudentSubjectEnrollment.objects.filter(
                    student=obj.student,
                    exam_session=obj.exam_session,
                ).select_related('subject')
                for enrollment in enrolled:
                    data.append({
                        "subject_code": enrollment.subject.code,
                        "subject_name": enrollment.subject.name,
                        "subject_title": enrollment.subject.name,
                        "date": None,
                        "exam_date": None,
                        "start_time": None,
                        "end_time": None,
                        "exam_time": "TBA",
                        "room": "TBA",
                        "room_allocated": "TBA",
                        "room_number": "TBA",
                        "seat": "Unassigned",
                        "desk_number": "Unassigned",
                        "slot_id": None,
                        "is_cie": True,
                        "question_paper_id": papers_map.get(enrollment.subject_id),
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
