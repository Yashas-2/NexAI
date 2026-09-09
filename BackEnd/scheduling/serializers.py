"""NexAI Scheduling – Serializers"""
from rest_framework import serializers
from .models import Subject, Room, ExamSession, TimetableSlot, InvigilationDuty, StudentSubjectEnrollment
from users.models import Department, User

class SubjectSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source="department.code", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    coordinator = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=["FACULTY", "HOD"]),
        required=False,
        allow_null=True,
    )
    coordinator_name = serializers.CharField(source="coordinator.full_name", read_only=True, default=None)
    enrolled_students = serializers.SerializerMethodField()

    def get_enrolled_students(self, obj):
        return StudentSubjectEnrollment.objects.filter(subject=obj).values('student').distinct().count()

    class Meta:
        model = Subject
        fields = [
            "id", "code", "name", "subject_type", "department", "department_code",
            "department_name", "semester", "credits", "batch_year",
            "exam_duration_mins", "enrolled_students", "co_list", "co_po_mapping",
            "coordinator", "coordinator_name",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RoomSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source="department.code", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = Room
        fields = [
            "id", "name", "building", "floor", "department", "department_code", "department_name",
            "total_capacity", "exam_capacity", "has_cctv", "has_wifi", "is_lab", "is_active",
        ]
        read_only_fields = ["id"]


class ExamSessionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    slot_count = serializers.SerializerMethodField()
    subject_list = serializers.SerializerMethodField()
    subject_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    rooms = serializers.SerializerMethodField()
    subject_codes = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = ExamSession
        fields = [
            "id", "name", "session_type", "semester", "semesters", "departments",
            "academic_year", "start_date", "end_date",
            "exams_per_day", "selected_slots",
            "status", "scheduling_task_id", "created_by", "created_by_name",
            "slot_count", "subject_list", "subject_count", "student_count", "rooms",
            "created_at", "subject_codes"
        ]
        read_only_fields = ["id", "scheduling_task_id", "status", "created_at"]

    def get_slot_count(self, obj):
        return obj.timetable_slots.count()

    def get_subject_list(self, obj):
        return list(obj.subjects.values_list("code", flat=True))

    def get_subject_count(self, obj):
        return obj.subjects.count()

    def get_student_count(self, obj):
        """Return distinct student count across ALL subjects in this session, no duplicate USNs."""
        from .models import StudentSubjectEnrollment
        return StudentSubjectEnrollment.objects.filter(
            exam_session=obj
        ).values('student').distinct().count()

    def get_rooms(self, obj):
        """Return deduplicated list of room names allocated to this session via timetable slots."""
        return list(
            obj.timetable_slots.exclude(room__isnull=True)
            .values_list("room__name", flat=True).distinct()
        )

    def create(self, validated_data):
        subject_codes = validated_data.pop("subject_codes", [])
        session = super().create(validated_data)
        if subject_codes:
            from .models import Subject
            subjects = Subject.objects.filter(code__in=subject_codes)
            session.subjects.set(subjects)
            
            # Auto-create CIE Configurations if this is a CIE session
            if 'CIE' in session.name.upper():
                from cie.models import CIEConfiguration
                from datetime import time as _time
                for subject in subjects:
                    cie_num = CIEConfiguration.CIENumber.CIE_1
                    if 'CIE 2' in session.name.upper() or 'CIE-2' in session.name.upper():
                        cie_num = CIEConfiguration.CIENumber.CIE_2
                    elif 'CIE 3' in session.name.upper() or 'CIE-3' in session.name.upper():
                        cie_num = CIEConfiguration.CIENumber.CIE_3
                        
                    CIEConfiguration.objects.get_or_create(
                        subject=subject,
                        exam_session=session,
                        cie_number=cie_num,
                        defaults={
                            'created_by': session.created_by,
                            'max_marks': 50,
                            'duration_mins': 90,
                            'scheduled_date': session.start_date,
                            'scheduled_time': _time(10, 0),
                            'is_active': True
                        }
                    )

                # Auto-enroll all eligible students (same dept, semester) into this CIE session
                from users.models import Student
                from .models import StudentSubjectEnrollment
                dept = getattr(session.created_by, 'department', None)
                sems = session.semesters or ([session.semester] if session.semester else [])
                for subject in subjects:
                    students = Student.objects.filter(
                        department=subject.department,
                        current_semester__in=sems if sems else [subject.semester],
                    )
                    for student in students:
                        StudentSubjectEnrollment.objects.get_or_create(
                            student=student,
                            subject=subject,
                            exam_session=session,
                        )

        # Auto-generate hall tickets for the session
        if session.subjects.exists():
            from eligibility.tasks import generate_hall_tickets_for_session
            generate_hall_tickets_for_session(str(session.id))

        return session

    def update(self, instance, validated_data):
        subject_codes = validated_data.pop("subject_codes", None)
        instance = super().update(instance, validated_data)
        if subject_codes is not None:
            subjects = Subject.objects.filter(code__in=subject_codes)
            instance.subjects.set(subjects)
        return instance



class TimetableSlotSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    room_capacity = serializers.IntegerField(source="room.exam_capacity", read_only=True)
    seat_map = serializers.JSONField(read_only=True)
    semester = serializers.SerializerMethodField()

    class Meta:
        model = TimetableSlot
        fields = [
            "id", "exam_session", "subject", "subject_code", "subject_name",
            "room", "room_name", "room_capacity",
            "exam_date", "start_time", "end_time", "status", "solver_score",
            "seat_map", "semester"
        ]
        read_only_fields = ["id", "solver_score"]

    def get_semester(self, obj):
        # Try to get semester from subject or return None
        try:
            return getattr(obj.subject, 'semester', None)
        except:
            return None


class InvigilationDutySerializer(serializers.ModelSerializer):
    invigilator_name = serializers.CharField(source="invigilator.full_name", read_only=True)
    employee_id = serializers.CharField(source="invigilator.employee_id", read_only=True)
    room_name = serializers.CharField(source="timetable_slot.room.name", read_only=True)
    exam_date = serializers.DateField(source="timetable_slot.exam_date", read_only=True)
    start_time = serializers.TimeField(source="timetable_slot.start_time", read_only=True)
    end_time = serializers.TimeField(source="timetable_slot.end_time", read_only=True)

    class Meta:
        model = InvigilationDuty
        fields = [
            "id", "timetable_slot", "invigilator", "invigilator_name", "employee_id",
            "room_name", "exam_date", "start_time", "end_time",
            "duty_role", "assigned_at"
        ]
        read_only_fields = ["id", "assigned_at"]


class TimetableGenerateSerializer(serializers.Serializer):
    """Request body for triggering the Celery timetabling task."""
    exam_session_id = serializers.UUIDField()
    time_limit_secs = serializers.IntegerField(default=120, min_value=30, max_value=600)


class StudentSubjectEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.full_name", read_only=True)
    student_usn = serializers.CharField(source="student.usn", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    exam_session_name = serializers.CharField(source="exam_session.name", read_only=True)
    subject_title = serializers.CharField(source="subject.name", read_only=True)
    attended_classes = serializers.IntegerField(default=0)
    total_classes = serializers.IntegerField(default=0)
    attendance_percentage = serializers.FloatField(default=100.0)
    cie_status = serializers.CharField(default="TBA")

    class Meta:
        model = StudentSubjectEnrollment
        fields = [
            "id", "student", "student_name", "student_usn",
            "subject", "subject_code", "subject_name", "subject_title",
            "exam_session", "exam_session_name", "enrolled_at",
            "attended_classes", "total_classes", "attendance_percentage", "cie_status"
        ]
        read_only_fields = ["id", "enrolled_at"]

from .models import InvigilatorSessionKey

class InvigilatorSessionKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvigilatorSessionKey
        fields = ["id", "duty", "session_key", "is_active", "generated_at", "activated_at", "closed_at"]
        read_only_fields = ["id", "session_key", "generated_at", "activated_at", "closed_at"]
