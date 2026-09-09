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

    cie_marks = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Continuous Internal Evaluation Marks")
    see_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Semester End Examination Marks")
    total_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=6, choices=GradeChoices.choices, null=True, blank=True)

    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_result"
        unique_together = [("student", "subject", "exam_session")]

    def save(self, *args, **kwargs):
        if self.cie_marks is not None and self.see_marks is not None:
            self.total_marks = float(self.cie_marks) + float(self.see_marks)
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
    
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

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
    marks_awarded = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "student_see_answer"
        unique_together = [("attempt", "question")]

    def __str__(self):
        return f"Answer to {self.question.id} by {self.attempt.student.usn}"
