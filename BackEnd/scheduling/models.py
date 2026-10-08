"""
NexAI Scheduling – Subject, Room, ExamSession, TimetableSlot, InvigilationDuty
These are the core academic/scheduling models consumed by the OR-Tools engine.
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator


class Subject(models.Model):
    """
    An academic subject (paper) that appears in an exam timetable.
    Tied to a department and a semester; enrolled students link via
    StudentSubjectEnrollment.
    """

    class SubjectType(models.TextChoices):
        CORE = "CORE", "Core Subject"
        ELECTIVE = "ELECTIVE", "Elective Subject"
        LAB = "LAB", "Laboratory / Practical"
        PROJECT = "PROJECT", "Project / Seminar"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identity ──────────────────────────────────────────────────────────────
    code = models.CharField(max_length=20, unique=True, help_text="e.g. CS601")
    name = models.CharField(max_length=200)
    subject_type = models.CharField(
        max_length=10, choices=SubjectType.choices, default=SubjectType.CORE
    )

    # ── Academic context ──────────────────────────────────────────────────────
    department = models.ForeignKey(
        "users.Department",
        on_delete=models.PROTECT,
        related_name="subjects",
    )
    semester = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Semester number (1–8)",
    )
    credits = models.PositiveSmallIntegerField(default=4)
    batch_year = models.PositiveSmallIntegerField(
        help_text="Batch year this subject applies to (e.g. 2022)"
    )

    # ── Exam duration ─────────────────────────────────────────────────────────
    exam_duration_mins = models.PositiveSmallIntegerField(
        default=180,
        help_text="SEE exam duration in minutes (default 3 hours)",
    )

    # ── Course Outcomes ───────────────────────────────────────────────────────
    co_list = models.JSONField(
        default=list,
        help_text="List of CO codes, e.g. ['CO1','CO2','CO3']",
    )
    co_po_mapping = models.JSONField(
        default=dict,
        help_text="Mapping of COs to POs, e.g. {'CO1': {'PO1': 3, 'PO2': 2}}",
    )

    coordinator = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_subjects",
        limit_choices_to={"role__in": ["FACULTY", "HOD"]},
        help_text="Faculty member assigned as course coordinator",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scheduling_subject"
        ordering = ["semester", "code"]
        unique_together = [("code", "batch_year")]

    def __str__(self):
        return f"{self.code} – {self.name} (Sem {self.semester})"


class Room(models.Model):
    """Physical examination room / lab."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Room 101")
    building = models.CharField(max_length=100)
    floor = models.PositiveSmallIntegerField(default=0)
    department = models.ForeignKey(
        "users.Department",
        on_delete=models.PROTECT,
        related_name="rooms",
        null=True,
        blank=True,
        help_text="Department this room belongs to (null = shared/common)",
    )
    total_capacity = models.PositiveSmallIntegerField()
    exam_capacity = models.PositiveSmallIntegerField(
        help_text="Max students allowed during an exam (usually 60–70% of total)"
    )
    rows_count = models.PositiveSmallIntegerField(default=0, help_text="Number of seat rows in the room")
    cols_count = models.PositiveSmallIntegerField(default=0, help_text="Number of seat columns in the room")
    bench_style = models.CharField(
        max_length=20,
        default='SINGLE_SEATER',
        choices=[('SINGLE_SEATER', 'Single Seater'), ('DOUBLE_SEATER', 'Double Seater')],
    )
    has_cctv = models.BooleanField(default=True)
    has_wifi = models.BooleanField(default=False)
    is_lab = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "scheduling_room"
        ordering = ["building", "floor", "name"]

    def __str__(self):
        return f"{self.name} ({self.building}, Cap: {self.exam_capacity})"


class ExamSession(models.Model):
    """
    A scheduled examination window (e.g. 'Nov-Dec 2024 SEE').
    The OR-Tools engine generates TimetableSlots inside this session.
    """

    class SessionStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SCHEDULED = "SCHEDULED", "Timetable Generated"
        ACTIVE = "ACTIVE", "Exams In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class SessionType(models.TextChoices):
        CIE = "CIE", "CIE - Continuous Internal Evaluation"
        SEE = "SEE", "SEE - Semester End Examination"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text="e.g. Nov-Dec 2024 SEE")
    session_type = models.CharField(
        max_length=10,
        choices=SessionType.choices,
        default=SessionType.SEE,
    )
    semester = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Primary semester (nullable for multi-semester CoE sessions)"
    )
    semesters = models.JSONField(
        default=list, blank=True,
        help_text="All semesters included in this session, e.g. [3,5,7]"
    )
    departments = models.JSONField(
        default=list, blank=True,
        help_text="Dept codes included, e.g. ['CSE','ECE']"
    )
    academic_year = models.CharField(max_length=10, help_text="e.g. 2024-25")
    start_date = models.DateField()
    end_date = models.DateField()
    exams_per_day = models.PositiveSmallIntegerField(
        default=1,
        help_text="Maximum exam sessions per day (1 or 2)"
    )
    selected_slots = models.JSONField(
        default=list, blank=True,
        help_text="Selected time slots, e.g. ['09:30 AM - 11:00 AM']"
    )
    selected_rooms = models.JSONField(
        default=list, blank=True,
        help_text="Selected room names, e.g. ['CRB-1', 'CRB-2']"
    )
    status = models.CharField(
        max_length=15,
        choices=SessionStatus.choices,
        default=SessionStatus.DRAFT,
        db_index=True,
    )
    scheduling_task_id = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Celery task ID for timetable generation"
    )
    subjects = models.ManyToManyField(
        "Subject",
        related_name="exam_sessions",
        blank=True,
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_exam_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scheduling_exam_session"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class TimetableSlot(models.Model):
    """
    A single scheduled exam slot: Subject × Room × Date × Time.
    Generated by the OR-Tools CP-SAT solver via a Celery task.
    """

    class SlotStatus(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
        RESCHEDULED = "RESCHEDULED", "Rescheduled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam_session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="timetable_slots",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="timetable_slots",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="timetable_slots",
    )

    # ── Time ──────────────────────────────────────────────────────────────────
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=15,
        choices=SlotStatus.choices,
        default=SlotStatus.SCHEDULED,
    )

    # ── Solver metadata ───────────────────────────────────────────────────────
    solver_score = models.FloatField(
        null=True, blank=True,
        help_text="Objective score from OR-Tools solver for this slot"
    )

    # ── Seating Arrangement ───────────────────────────────────────────────────
    seat_map = models.JSONField(
        default=dict, blank=True,
        help_text="Mapping of USN to specific seat coordinate, e.g. {'1MS24CS001': 'R1C2'}"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scheduling_timetable_slot"
        ordering = ["exam_date", "start_time"]
        # Hard constraint: no two subjects in the same room at the same time
        # unique_together removed to support multi-subject interleaving

    def __str__(self):
        return (
            f"{self.subject.code} | {self.room.name} | "
            f"{self.exam_date} {self.start_time}"
        )


class InvigilationDuty(models.Model):
    """Maps an invigilator (User) to a TimetableSlot."""

    class DutyRole(models.TextChoices):
        CHIEF = "CHIEF", "Chief Invigilator"
        RELIEF = "RELIEF", "Relief Invigilator"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable_slot = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="invigilation_duties",
    )
    invigilator = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="invigilation_duties",
        limit_choices_to={"role__in": ["INVIGILATOR", "FACULTY", "EVALUATOR"]},
    )
    duty_role = models.CharField(
        max_length=10,
        choices=DutyRole.choices,
        default=DutyRole.CHIEF,
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scheduling_invigilation_duty"
        # An invigilator cannot be in two rooms at the same time
        unique_together = [("timetable_slot", "invigilator")]

    def __str__(self):
        return (
            f"{self.invigilator.full_name} → "
            f"{self.timetable_slot.subject.code} [{self.duty_role}]"
        )


class InvigilatorSessionKey(models.Model):
    """
    Cryptographic key issued per TimetableSlot + InvigilationDuty to unlock
    the scanning app and student SEE exams.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    duty = models.OneToOneField(
        InvigilationDuty,
        on_delete=models.CASCADE,
        related_name="session_key"
    )
    session_key = models.CharField(
        max_length=12,
        unique=True,
        help_text="Time-locked OTP or cryptographic key, e.g. EVAL-3F8B-4A12"
    )
    is_active = models.BooleanField(
        default=False,
        help_text="Becomes True when invigilator starts the session, unlocking student screens"
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "scheduling_invigilator_session_key"

    def __str__(self):
        return f"Key for {self.duty}"


class StudentSubjectEnrollment(models.Model):
    """
    Maps a Student to a Subject for a given ExamSession.
    Used by the OR-Tools engine to enforce 'no student in two exams simultaneously'.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="subject_enrollments",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="student_enrollments",
    )
    exam_session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="student_enrollments",
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scheduling_student_subject_enrollment"
        unique_together = [("student", "subject", "exam_session")]

    def __str__(self):
        return (
            f"{self.student.usn} → {self.subject.code} "
            f"[{self.exam_session.name}]"
        )


class StudentExamAttendance(models.Model):
    """
    Tracks the attendance, scanning, and booklet state for a single student in a specific exam slot.
    """
    class AttendanceStatus(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        MALPRACTICE = "malpractice", "Malpractice"
        UNVERIFIED = "unverified", "Unverified"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable_slot = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="attendances"
    )
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="exam_attendances"
    )
    desk_id = models.CharField(max_length=20, help_text="e.g. Desk B-01")
    seat_position = models.CharField(max_length=20, help_text="e.g. Row 1, Col 1")
    
    status = models.CharField(
        max_length=20, 
        choices=AttendanceStatus.choices, 
        default=AttendanceStatus.UNVERIFIED
    )
    is_qr_verified = models.BooleanField(default=False)
    is_biometric_matched = models.BooleanField(default=False)
    
    booklet_barcode = models.CharField(max_length=100, null=True, blank=True)
    dummy_barcode = models.CharField(max_length=100, null=True, blank=True)
    digitized_pages_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "scheduling_student_exam_attendance"
        unique_together = [("timetable_slot", "student")]

    def __str__(self):
        return f"{self.student.usn} - {self.timetable_slot} ({self.status})"


class ExamIncidentReport(models.Model):
    """
    Incident report created by Invigilator for malpractice or other issues.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable_slot = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="incidents"
    )
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="exam_incidents"
    )
    reported_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="reported_incidents"
    )
    infraction_type = models.CharField(max_length=100)
    description = models.TextField()
    is_broadcasted_to_coe = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "scheduling_exam_incident_report"
        
    def __str__(self):
        return f"{self.infraction_type} - {self.student.usn}"


# ─── Reschedule audit trail ──────────────────────────────────────────────────
ACTIVE_SLOT_STATUSES = (TimetableSlot.SlotStatus.SCHEDULED, TimetableSlot.SlotStatus.CONFIRMED)


class TimetableRescheduleLog(models.Model):
    """
    Immutable audit record created whenever an existing TimetableSlot is
    archived (status -> RESCHEDULED/CANCELLED) instead of being deleted.
    Old schedule stays queryable for audit; student-facing queries only
    read ACTIVE_SLOT_STATUSES.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slot = models.ForeignKey(
        TimetableSlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reschedule_logs",
    )
    exam_session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="reschedule_logs",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reschedule_logs",
    )
    # Snapshot of the archived schedule (survives even if the slot row is removed)
    subject_code = models.CharField(max_length=20, blank=True, default="")
    subject_name = models.CharField(max_length=200, blank=True, default="")
    room_name = models.CharField(max_length=100, blank=True, default="")
    exam_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    previous_status = models.CharField(max_length=15, blank=True, default="")
    reason = models.CharField(max_length=255, blank=True, default="")
    changed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reschedule_logs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scheduling_timetable_reschedule_log"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.subject_code} {self.exam_date} {self.start_time} "
            f"archived ({self.previous_status}) - {self.reason}"
        )


def archive_slots(queryset, reason="", user=None):
    """
    Archive timetable slots instead of deleting them: status -> RESCHEDULED
    plus a TimetableRescheduleLog audit row. Returns number archived.
    """
    archived = 0
    for slot in queryset.select_related("subject", "room", "exam_session"):
        if slot.status == TimetableSlot.SlotStatus.RESCHEDULED:
            continue
        TimetableRescheduleLog.objects.create(
            slot=slot,
            exam_session_id=slot.exam_session_id,
            subject_id=slot.subject_id,
            subject_code=slot.subject.code if slot.subject else "",
            subject_name=slot.subject.name if slot.subject else "",
            room_name=slot.room.name if slot.room else "",
            exam_date=slot.exam_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            previous_status=slot.status,
            reason=reason or "Schedule regenerated",
            changed_by=user,
        )
        slot.status = TimetableSlot.SlotStatus.RESCHEDULED
        slot.save(update_fields=["status"])
        archived += 1
    return archived

