"""
NexAI Evaluation – AnswerScript model and related grading models.
An AnswerScript is the digitized, anonymized student answer booklet.
"""
import uuid
from django.db import models


class EvaluationBundle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    evaluator = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="evaluation_bundles",
        limit_choices_to={"role__in": ["EVALUATOR", "SCRUTINIZER", "FACULTY"]},
    )
    subject = models.ForeignKey("scheduling.Subject", on_delete=models.CASCADE)
    exam_session = models.ForeignKey("scheduling.ExamSession", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20, 
        choices=[("ASSIGNED", "Assigned"), ("IN_PROGRESS", "In Progress"), ("COMPLETED", "Completed")],
        default="ASSIGNED"
    )

    class Meta:
        db_table = "evaluation_bundle"

    def __str__(self):
        return f"{self.name} - {self.evaluator.full_name if self.evaluator else 'Unassigned'}"

class AnswerScript(models.Model):
    """
    Digitized, anonymized answer booklet uploaded by an Invigilator
    via the Flutter scanning app.

    The student's USN is masked on-device; only the evaluation_code
    (alphanumeric dummy ID) is transmitted and stored here.
    The USN ↔ evaluation_code mapping is held in a separate secure
    lookup table (AnswerScriptKeyMap) accessible only to the CoE.
    """

    class ScriptStatus(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded – Pending Assignment"
        ASSIGNED = "ASSIGNED", "Assigned to Evaluator"
        IN_PROGRESS = "IN_PROGRESS", "Evaluation In Progress"
        COMPLETED = "COMPLETED", "Evaluation Completed"
        ESCALATED = "ESCALATED", "Escalated to Scrutinizer"
        FINALIZED = "FINALIZED", "Grade Finalized"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Paper & Session Context ────────────────────────────────────────────────
    question_paper = models.ForeignKey(
        "vault.QuestionPaper",
        on_delete=models.PROTECT,
        related_name="answer_scripts",
    )
    timetable_slot = models.ForeignKey(
        "scheduling.TimetableSlot",
        on_delete=models.PROTECT,
        related_name="answer_scripts",
        null=True,
        blank=True,
    )

    # ── Anonymization ─────────────────────────────────────────────────────────
    evaluation_code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Anonymous alphanumeric code generated on-device. "
                  "Replaces USN during evaluation.",
    )
    hall_ticket_barcode = models.CharField(
        max_length=50,
        help_text="Original barcode read from the answer sheet top-strip "
                  "(only stored in KeyMap, never in this model).",
        blank=True,  # blank here – full value in KeyMap only
    )

    # ── Upload metadata ───────────────────────────────────────────────────────
    scanning_session = models.ForeignKey(
        "scanning.ScanningSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="answer_scripts",
    )
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_scripts",
        limit_choices_to={"role": "INVIGILATOR"},
    )
    page_count = models.PositiveSmallIntegerField(default=0)
    upload_complete = models.BooleanField(default=False)
    upload_started_at = models.DateTimeField(auto_now_add=True)
    upload_completed_at = models.DateTimeField(null=True, blank=True)

    # ── AI Evaluation summary ─────────────────────────────────────────────────
    ai_total_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Sum of BERT-suggested scores across all questions",
    )
    evaluator_total_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Human evaluator's final total score",
    )
    max_marks = models.PositiveSmallIntegerField(default=100)

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=15,
        choices=ScriptStatus.choices,
        default=ScriptStatus.UPLOADED,
        db_index=True,
    )
    assigned_evaluator = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_scripts",
        limit_choices_to={"role__in": ["EVALUATOR", "SCRUTINIZER", "FACULTY"]},
    )
    evaluation_bundle = models.ForeignKey(
        "EvaluationBundle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="answer_scripts",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "evaluation_answer_script"
        ordering = ["-upload_started_at"]

    def __str__(self):
        return (
            f"Script {self.evaluation_code} | "
            f"{self.question_paper.subject.code} [{self.status}]"
        )

    @property
    def score_deviation(self):
        """Absolute difference between AI suggestion and human grade."""
        if self.ai_total_score is not None and self.evaluator_total_score is not None:
            return abs(float(self.evaluator_total_score) - float(self.ai_total_score))
        return None


class AnswerScriptKeyMap(models.Model):
    """
    Secure mapping: evaluation_code ↔ student USN.
    This table is CoE-only (restricted permission) and is the ONLY
    place where the anonymization is broken.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    answer_script = models.OneToOneField(
        AnswerScript,
        on_delete=models.CASCADE,
        related_name="key_map",
    )
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.PROTECT,
        related_name="answer_script_keys",
    )
    revealed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the CoE de-anonymized this script (result publication)",
    )

    class Meta:
        db_table = "evaluation_answer_script_key_map"

    def __str__(self):
        return f"KeyMap: {self.answer_script.evaluation_code} → {self.student.usn}"


class ScriptPage(models.Model):
    """An individual scanned page of an AnswerScript."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    answer_script = models.ForeignKey(
        AnswerScript,
        on_delete=models.CASCADE,
        related_name="pages",
    )
    page_number = models.PositiveSmallIntegerField()
    s3_url = models.CharField(max_length=500, help_text="S3/MinIO signed URL")
    quality_score = models.FloatField(
        null=True, blank=True,
        help_text="BRISQUE no-reference quality score (lower = better)",
    )
    blur_detected = models.BooleanField(default=False)
    glare_detected = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "evaluation_script_page"
        ordering = ["page_number"]
        unique_together = [("answer_script", "page_number")]

    def __str__(self):
        return f"Page {self.page_number} of {self.answer_script.evaluation_code}"


class QuestionGrade(models.Model):
    """
    Per-question grade record: BERT suggestion vs human override.
    One record per (AnswerScript, Question) pair.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    answer_script = models.ForeignKey(
        AnswerScript,
        on_delete=models.CASCADE,
        related_name="question_grades",
    )
    question = models.ForeignKey(
        "vault.Question",
        on_delete=models.PROTECT,
        related_name="question_grades",
    )

    # ── AI Score ──────────────────────────────────────────────────────────────
    ai_suggested_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    ai_confidence = models.FloatField(
        null=True, blank=True, help_text="BERT similarity confidence [0–1]"
    )
    ai_feedback = models.JSONField(
        default=dict,
        help_text="BERT analysis: keyword hits, Bloom alignment, etc.",
    )

    # ── Human Grade ───────────────────────────────────────────────────────────
    evaluator_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    evaluator = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_questions",
    )
    override_reason = models.TextField(blank=True)
    evaluated_at = models.DateTimeField(null=True, blank=True)
    time_spent_secs = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "evaluation_question_grade"
        unique_together = [("answer_script", "question")]

    def __str__(self):
        return (
            f"{self.answer_script.evaluation_code} | "
            f"Q{self.question.question_number} | "
            f"AI={self.ai_suggested_score} Human={self.evaluator_score}"
        )
