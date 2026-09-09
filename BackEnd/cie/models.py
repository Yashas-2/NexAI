"""
NexAI CIE – Models for Continuous Internal Evaluation
Handles: CIE Sessions, Marks per student per CIE, Assignment Marks,
CIE Answer Attempts, and Question Paper Scrutiny by HOD.
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class CIEConfiguration(models.Model):
    """
    Configuration for a CIE exam for a specific subject+session.
    Created by HOD after ExamSession is set up.
    """
    class CIENumber(models.TextChoices):
        CIE_1 = "CIE_1", "CIE 1"
        CIE_2 = "CIE_2", "CIE 2"
        CIE_3 = "CIE_3", "CIE 3"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    subject = models.ForeignKey(
        "scheduling.Subject",
        on_delete=models.CASCADE,
        related_name="cie_configurations",
    )
    exam_session = models.ForeignKey(
        "scheduling.ExamSession",
        on_delete=models.CASCADE,
        related_name="cie_configurations",
    )
    cie_number = models.CharField(
        max_length=10,
        choices=CIENumber.choices,
        default=CIENumber.CIE_1,
    )
    assigned_faculty = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_cie_configs",
        limit_choices_to={"role__in": ["FACULTY", "HOD"]},
        help_text="Faculty responsible for conducting this CIE",
    )

    # Marks configuration
    max_marks = models.PositiveSmallIntegerField(default=50)
    duration_mins = models.PositiveSmallIntegerField(default=60)

    # Scheduling
    scheduled_date = models.DateField(null=True, blank=True)
    scheduled_time = models.TimeField(null=True, blank=True)

    is_active = models.BooleanField(
        default=False,
        help_text="True when HOD has activated the CIE for students to write",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_cie_configs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cie_configuration"
        unique_together = [("subject", "exam_session", "cie_number")]
        ordering = ["cie_number"]

    def __str__(self):
        return f"{self.cie_number} | {self.subject.code} | {self.exam_session.name}"


class CIEMarks(models.Model):
    """
    Marks awarded to a student for a specific CIE attempt.
    Entered by Faculty after evaluation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="cie_marks",
    )
    cie_config = models.ForeignKey(
        CIEConfiguration,
        on_delete=models.CASCADE,
        related_name="student_marks",
    )

    marks_awarded = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Marks given to this student for this CIE",
    )
    is_absent = models.BooleanField(default=False)
    remarks = models.CharField(max_length=500, blank=True)

    entered_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="entered_cie_marks",
        limit_choices_to={"role__in": ["FACULTY", "HOD"]},
    )
    entered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cie_marks"
        unique_together = [("student", "cie_config")]
        ordering = ["cie_config__cie_number", "student__usn"]

    def __str__(self):
        return f"{self.student.usn} – {self.cie_config} – {self.marks_awarded}"

    @property
    def percentage(self):
        if self.cie_config.max_marks:
            return float(self.marks_awarded / self.cie_config.max_marks * 100)
        return 0.0


class AssignmentMarks(models.Model):
    """
    Assignment / project marks for a student in a subject for a session.
    Entered by Faculty.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="assignment_marks",
    )
    subject = models.ForeignKey(
        "scheduling.Subject",
        on_delete=models.CASCADE,
        related_name="assignment_marks",
    )
    exam_session = models.ForeignKey(
        "scheduling.ExamSession",
        on_delete=models.CASCADE,
        related_name="assignment_marks",
    )

    marks_awarded = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Assignment marks out of 10",
    )
    max_marks = models.PositiveSmallIntegerField(default=10)

    entered_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="entered_assignment_marks",
    )
    entered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cie_assignment_marks"
        unique_together = [("student", "subject", "exam_session")]

    def __str__(self):
        return f"{self.student.usn} – {self.subject.code} – Assignment: {self.marks_awarded}"


class CIEQuestionPaperScrutiny(models.Model):
    """
    HOD scrutiny record for a CIE question paper.
    Separate from the SEE vault/approval workflow.
    """
    class ScrutinyStatus(models.TextChoices):
        PENDING = "PENDING", "Pending HOD Review"
        APPROVED = "APPROVED", "Approved by HOD"
        REJECTED = "REJECTED", "Rejected – Needs Revision"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    cie_config = models.OneToOneField(
        CIEConfiguration,
        on_delete=models.CASCADE,
        related_name="scrutiny",
    )

    # Paper content (simplified for CIE – can be a document upload or text)
    paper_title = models.CharField(max_length=300)
    paper_content = models.TextField(
        help_text="Question paper content in text/markdown (faculty-entered)",
    )
    answer_key = models.TextField(
        blank=True,
        help_text="Answer key / rubric (visible only to HOD and faculty)",
    )

    submitted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="submitted_cie_papers",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    # HOD review
    status = models.CharField(
        max_length=10,
        choices=ScrutinyStatus.choices,
        default=ScrutinyStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_cie_papers",
        limit_choices_to={"role": "HOD"},
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, help_text="HOD approval/rejection note")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cie_question_paper_scrutiny"

    def __str__(self):
        return f"Scrutiny – {self.cie_config} [{self.status}]"

class CIEAttempt(models.Model):
    """
    A student's digital attempt for a Continuous Internal Evaluation (CIE)
    via the Flutter app.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "users.Student", on_delete=models.CASCADE, related_name="cie_attempts"
    )
    cie_config = models.ForeignKey(
        CIEConfiguration, on_delete=models.CASCADE, related_name="cie_attempts"
    )
    
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    class Meta:
        db_table = "cie_attempt"
        unique_together = [("student", "cie_config")]

    def __str__(self):
        return f"{self.student.usn} - {self.cie_config.cie_number} Attempt"


class CIEAnswer(models.Model):
    """
    Individual digital answers for a CIE attempt.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(CIEAttempt, on_delete=models.CASCADE, related_name="answers")
    question_text = models.CharField(max_length=500, blank=True, help_text="Stored since CIE might use a simple text-based paper")
    answer_text = models.TextField(blank=True)
    marks_awarded = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "cie_answer"

    def __str__(self):
        return f"Answer by {self.attempt.student.usn}"
