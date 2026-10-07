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
            "total_capacity", "exam_capacity", "rows_count", "cols_count", "bench_style",
            "has_cctv", "has_wifi", "is_lab", "is_active",
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
            "exams_per_day", "selected_slots", "selected_rooms",
            "status", "scheduling_task_id", "created_by", "created_by_name",
            "slot_count", "subject_list", "subject_count", "student_count", "rooms",
            "created_at", "subject_codes"
        ]
        read_only_fields = ["id", "scheduling_task_id", "status", "created_at", "created_by"]

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
        calculated_sessions = self.initial_data.get("calculated_sessions", [])
        session = super().create(validated_data)
        if subject_codes:
            from .models import Subject, TimetableSlot, InvigilationDuty, Room, InvigilatorSessionKey, StudentSubjectEnrollment
            from users.models import User, Student
            from datetime import datetime
            subjects = Subject.objects.filter(code__in=subject_codes)
            session.subjects.set(subjects)
            
            subject_map = {sub.code: sub for sub in subjects}

            # Persist selected rooms from calculated_sessions
            all_rooms = set()
            if calculated_sessions:
                for cs in calculated_sessions:
                    for r in cs.get("roomsAllocated", []):
                        all_rooms.add(r)
                if all_rooms:
                    session.selected_rooms = list(all_rooms)
                    session.save(update_fields=["selected_rooms"])

            if calculated_sessions:
                for calc_session in calculated_sessions:
                    subject = subject_map.get(calc_session.get("subjectCode"))
                    if not subject: continue

                    exam_date_str = calc_session.get("examDate")
                    time_slot_str = calc_session.get("timeSlot")
                    start_time_str, end_time_str = time_slot_str.split(" - ")
                    start_time = datetime.strptime(start_time_str, "%I:%M %p").time()
                    end_time = datetime.strptime(end_time_str, "%I:%M %p").time()

                    rooms_allocated = calc_session.get("roomsAllocated", [])
                    room_obj = None
                    if rooms_allocated:
                        room_obj = Room.objects.filter(name=rooms_allocated[0]).first()

                    slot = TimetableSlot.objects.create(
                        exam_session=session,
                        subject=subject,
                        room=room_obj,
                        exam_date=exam_date_str,
                        start_time=start_time,
                        end_time=end_time,
                        status="SCHEDULED"
                    )

                    invigilator_id = calc_session.get("chiefInvigilatorId")
                    if invigilator_id:
                        invigilator = User.objects.filter(id=invigilator_id).first()
                        if invigilator:
                            duty = InvigilationDuty.objects.create(
                                timetable_slot=slot,
                                invigilator=invigilator,
                                duty_role="CHIEF",
                            )
                            # Generate a unique secure key
                            import secrets
                            key = secrets.token_hex(4).upper()
                            InvigilatorSessionKey.objects.create(
                                duty=duty,
                                session_key=key,
                                is_active=True
                            )
            
            # Auto-create CIE Configurations if this is a CIE session
            if 'CIE' in session.name.upper():
                from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
                from datetime import time as _time
                for subject in subjects:
                    cie_num = CIEConfiguration.CIENumber.CIE_1
                    if 'CIE 2' in session.name.upper() or 'CIE-2' in session.name.upper():
                        cie_num = CIEConfiguration.CIENumber.CIE_2
                    elif 'CIE 3' in session.name.upper() or 'CIE-3' in session.name.upper():
                        cie_num = CIEConfiguration.CIENumber.CIE_3
                        
                    # Determine date and time from calculated_sessions if available
                    scheduled_date = session.start_date
                    scheduled_time = _time(10, 0)
                    duration_mins = 90
                    
                    if calculated_sessions:
                        for calc_session in calculated_sessions:
                            if calc_session.get("subjectCode") == subject.code:
                                scheduled_date = calc_session.get("examDate")
                                time_slot_str = calc_session.get("timeSlot")
                                start_time_str, end_time_str = time_slot_str.split(" - ")
                                start_time = datetime.strptime(start_time_str, "%I:%M %p").time()
                                end_time = datetime.strptime(end_time_str, "%I:%M %p").time()
                                scheduled_time = start_time
                                duration_mins = (end_time.hour * 60 + end_time.minute) - (start_time.hour * 60 + start_time.minute)
                                break

                    cie_config, created = CIEConfiguration.objects.get_or_create(
                        subject=subject,
                        exam_session=session,
                        cie_number=cie_num,
                        defaults={
                            'created_by': session.created_by,
                            'max_marks': 50,
                            'duration_mins': duration_mins,
                            'scheduled_date': scheduled_date,
                            'scheduled_time': scheduled_time,
                            'is_active': True
                        }
                    )

                    if created:
                        # Auto-link previously scrutinized questions if they exist for this subject and CIE number
                        latest_approved = CIEQuestionPaperScrutiny.objects.filter(
                            cie_config__subject=subject,
                            cie_config__cie_number=cie_num,
                            status='APPROVED'
                        ).order_by('-created_at').first()

                        if latest_approved:
                            CIEQuestionPaperScrutiny.objects.create(
                                cie_config=cie_config,
                                paper_title=latest_approved.paper_title,
                                paper_content=latest_approved.paper_content,
                                answer_key=latest_approved.answer_key,
                                submitted_by=latest_approved.submitted_by,
                                submitted_at=latest_approved.submitted_at,
                                status='APPROVED',
                                reviewed_by=latest_approved.reviewed_by,
                                reviewed_at=latest_approved.reviewed_at,
                                review_note="Auto-linked from previous approved scrutiny."
                            )

                # Auto-enroll all eligible students (same dept, semester) into this CIE session
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
    
    cie1 = serializers.SerializerMethodField()
    cie2 = serializers.SerializerMethodField()
    cie3 = serializers.SerializerMethodField()
    labOrProject = serializers.SerializerMethodField()

    class Meta:
        model = StudentSubjectEnrollment
        fields = [
            "id", "student", "student_name", "student_usn",
            "subject", "subject_code", "subject_name", "subject_title",
            "exam_session", "exam_session_name", "enrolled_at",
            "attended_classes", "total_classes", "attendance_percentage", "cie_status",
            "cie1", "cie2", "cie3", "labOrProject"
        ]
        read_only_fields = ["id", "enrolled_at"]
        
    def _get_eligibility(self, obj):
        if not hasattr(obj, '_cached_eligibility'):
            from eligibility.models import StudentEligibility
            obj._cached_eligibility = StudentEligibility.objects.filter(
                student=obj.student,
                subject=obj.subject
            ).order_by('-created_at').first()
        return obj._cached_eligibility

    def get_cie1(self, obj):
        elig = self._get_eligibility(obj)
        if elig and elig.cie1_marks is not None:
            return float(elig.cie1_marks)
        return None

    def get_cie2(self, obj):
        elig = self._get_eligibility(obj)
        if elig and elig.cie2_marks is not None:
            return float(elig.cie2_marks)
        return None

    def get_cie3(self, obj):
        elig = self._get_eligibility(obj)
        if elig and elig.cie3_marks is not None:
            return float(elig.cie3_marks)
        return None

    def get_labOrProject(self, obj):
        elig = self._get_eligibility(obj)
        if elig and elig.assignment_marks is not None:
            return float(elig.assignment_marks)
        return None

    def get_attendance_percentage(self, obj):
        elig = self._get_eligibility(obj)
        if elig and elig.attendance_percentage is not None:
            return float(elig.attendance_percentage)
        return None

from .models import InvigilatorSessionKey

class InvigilatorSessionKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvigilatorSessionKey
        fields = ["id", "duty", "session_key", "is_active", "generated_at", "activated_at", "closed_at"]
        read_only_fields = ["id", "session_key", "generated_at", "activated_at", "closed_at"]
