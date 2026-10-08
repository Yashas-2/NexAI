import uuid
from django.db import models

class Result(models.Model):
    class GradeChoices(models.TextChoices):
        S = "S", "Outstanding (90-100)"
        A = "A", "Excellent (80-89)"
        B = "B", "Very Good (70-79)"
        C = "C", "Good (60-69)"
        D = "D", "Above Average (50-59)"
        E = "E", "Average (40-49)"
        F = "F", "Fail (<40)"
        ABSENT = "ABSENT", "Absent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey("users.Student", on_delete=models.CASCADE, related_name="results")
    subject = models.ForeignKey("scheduling.Subject", on_delete=models.CASCADE, related_name="results")
    exam_session = models.ForeignKey("scheduling.ExamSession", on_delete=models.CASCADE, related_name="results")

    cie_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, default=None,
        help_text="Continuous Internal Evaluation Marks (null until real CIE data is available)",
    )
    see_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="SEE RAW marks out of 100 (never overwritten by the /50 conversion)",
    )
    see_converted_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="SEE scaled to /50: see_marks × 50 / 100 (computed in save())",
    )
    total_marks = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Final marks out of 100: cie_marks + see_converted_marks",
    )
    grade = models.CharField(max_length=6, choices=GradeChoices.choices, null=True, blank=True)

    is_published = models.BooleanField(
        default=False,
        help_text="True only when the CoE has announced/published this result",
    )
    announced_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the CoE officially announced this result",
    )
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_result"
        unique_together = [("student", "subject", "exam_session")]

    def save(self, *args, **kwargs):
        # SEE is examined out of 100 but contributes 50 marks to the final
        # total: converted = raw × 50/100. The raw value is never modified.
        raw_see = float(self.see_marks) if self.see_marks is not None else None
        if raw_see is not None:
            self.see_converted_marks = round(raw_see * 50 / 100, 2)
        else:
            self.see_converted_marks = None

        if self.cie_marks is not None and self.see_converted_marks is not None:
            self.total_marks = float(self.cie_marks) + float(self.see_converted_marks)
            if self.total_marks >= 90:
                self.grade = self.GradeChoices.S
            elif self.total_marks >= 80:
                self.grade = self.GradeChoices.A
            elif self.total_marks >= 70:
                self.grade = self.GradeChoices.B
            elif self.total_marks >= 60:
                self.grade = self.GradeChoices.C
            elif self.total_marks >= 50:
                self.grade = self.GradeChoices.D
            elif self.total_marks >= 40:
                self.grade = self.GradeChoices.E
            else:
                self.grade = self.GradeChoices.F
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.usn} - {self.subject.code} - Grade: {self.grade} ({self.total_marks})"

class SEEAttempt(models.Model):
    """
    A student's digital attempt for a Semester End Examination (SEE)
    via the Flutter app.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "users.Student", on_delete=models.CASCADE, related_name="see_attempts"
    )
    subject = models.ForeignKey(
        "scheduling.Subject", on_delete=models.CASCADE, related_name="see_attempts"
    )
    exam_session = models.ForeignKey(
        "scheduling.ExamSession", on_delete=models.CASCADE, related_name="see_attempts"
    )
    session_key = models.ForeignKey(
        "scheduling.InvigilatorSessionKey", 
        on_delete=models.SET_NULL, null=True, blank=True,
        help_text="The session key used to unlock this attempt"
    )
    evaluation_bundle = models.ForeignKey(
        "evaluation.EvaluationBundle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="see_attempts",
        help_text="Bundle this answer booklet was filed under by the Main Evaluator",
    )
    
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    proctor_strikes = models.PositiveSmallIntegerField(
        default=0,
        help_text="Proctoring violations recorded during the attempt (max 3)",
    )

    class Meta:
        db_table = "student_see_attempt"
        unique_together = [("student", "subject", "exam_session")]

    def __str__(self):
        return f"{self.student.usn} - {self.subject.code} SEE Attempt"


class SEEAnswer(models.Model):
    """
    Individual answers for a SEE attempt.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(SEEAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey("vault.Question", on_delete=models.PROTECT, related_name="see_answers")
    answer_text = models.TextField(blank=True)
    answer_image_base64 = models.TextField(
        blank=True, help_text="Base64 encoded images of the handwritten pages"
    )
    extracted_text = models.TextField(
        blank=True, help_text="Text extracted from the handwritten image via OCR"
    )
    marks_awarded = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "student_see_answer"
        unique_together = [("attempt", "question")]

    def __str__(self):
        return f"Answer to {self.question.id} by {self.attempt.student.usn}"
