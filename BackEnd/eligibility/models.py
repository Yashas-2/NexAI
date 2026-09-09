"""NexAI - Eligibility Models"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

from core.models import BaseModel
from users.models import Student
from scheduling.models import Subject, ExamSession


class StudentEligibility(BaseModel):
    """
    Tracks whether a student is eligible to write an exam for a specific subject
    in a given exam session based on attendance and CIE marks.
    """
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="eligibility_records"
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="eligibility_records"
    )
    exam_session = models.ForeignKey(
        ExamSession, on_delete=models.CASCADE, related_name="eligibility_records"
    )
    
    attendance_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Attendance percentage (0-100)"
    )
    cie1_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="CIE 1 Marks"
    )
    cie2_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="CIE 2 Marks"
    )
    cie3_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="CIE 3 Marks"
    )
    assignment_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Assignment Marks"
    )
    cie_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Total Continuous Internal Evaluation marks (Calculated)"
    )
    
    is_eligible = models.BooleanField(default=False)
    remarks = models.TextField(
        blank=True,
        help_text="System or manual remarks (e.g. 'Shortage of attendance')"
    )

    class Meta:
        db_table = "nexai_eligibility"
        verbose_name_plural = "Student Eligibilities"
        unique_together = ("student", "subject", "exam_session")

    def __str__(self):
        return f"{self.student.usn} - {self.subject.code} - Eligible: {self.is_eligible}"


class HallTicket(BaseModel):
    """
    Digital Hall Ticket generated for a student for an entire Exam Session.
    Usually generated only if the student has no major eligibility blocks,
    or lists only the subjects they are eligible for.
    """
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="hall_tickets"
    )
    exam_session = models.ForeignKey(
        ExamSession, on_delete=models.CASCADE, related_name="hall_tickets"
    )
    
    ticket_number = models.CharField(max_length=50, unique=True, db_index=True)
    qr_code_data = models.TextField(
        blank=True,
        help_text="Data encoded in the QR code (or URL to the QR image)"
    )
    is_revoked = models.BooleanField(
        default=False,
        help_text="If true, the hall ticket is invalid"
    )

    class Meta:
        db_table = "nexai_hall_ticket"
        unique_together = ("student", "exam_session")

    def __str__(self):
        return f"Ticket {self.ticket_number} - {self.student.usn}"

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            # Generate a unique ticket number: HT-{SESSION}-{USN}-{UUID[:6]}
            uid = str(uuid.uuid4())[:6].upper()
            self.ticket_number = f"HT-{self.exam_session.id}-{self.student.usn}-{uid}"
        super().save(*args, **kwargs)
