"""NexAI Notifications – Models"""
import uuid
from django.db import models
from users.models import User


class Notification(models.Model):
    """
    In-app notification sent to a user when a key system event occurs.
    Examples: hall ticket generated, result published, violation flagged.
    """

    class NotificationType(models.TextChoices):
        HALL_TICKET = "HALL_TICKET", "Hall Ticket Generated"
        EXAM_SCHEDULED = "EXAM_SCHEDULED", "Exam Scheduled"
        RESULT_PUBLISHED = "RESULT_PUBLISHED", "Result Published"
        VIOLATION_FLAGGED = "VIOLATION_FLAGGED", "Proctoring Violation Flagged"
        PAPER_APPROVED = "PAPER_APPROVED", "Question Paper Approved"
        ELIGIBILITY_UPDATE = "ELIGIBILITY_UPDATE", "Eligibility Status Updated"
        GENERAL = "GENERAL", "General"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=25,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)

    # Optional: link to a related object (e.g. a specific exam session)
    related_object_id = models.UUIDField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.notification_type}] → {self.recipient.email}: {self.title}"
