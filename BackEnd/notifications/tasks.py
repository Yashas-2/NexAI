"""NexAI Notifications – Celery Tasks"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def send_notification(user_id: int, title: str, message: str, notification_type: str = "GENERAL", related_object_id: str = None):
    """
    Reusable task to create an in-app notification for a user.

    Call this from any other app when a key event occurs, e.g.:
        send_notification.delay(user.id, "Result Published", "Your MAT101 result is available.", "RESULT_PUBLISHED")
    """
    from .models import Notification
    from users.models import User

    try:
        user = User.objects.get(id=user_id)
        Notification.objects.create(
            recipient=user,
            title=title,
            message=message,
            notification_type=notification_type,
            related_object_id=related_object_id,
        )
        logger.info(f"Notification sent to user {user.email}: {title}")
    except User.DoesNotExist:
        logger.error(f"send_notification: User {user_id} not found.")
    except Exception as exc:
        logger.error(f"send_notification failed: {exc}")
