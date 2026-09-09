"""NexAI Notifications – Utility helpers"""
from .models import Notification


def notify_user(user, notification_type, title, message, related_object_id=None):
    """Create an in-app notification for a user."""
    return Notification.objects.create(
        recipient=user,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_id=related_object_id,
    )


def notify_students_bulk(students, notification_type, title, message, related_object_id=None):
    """Create notifications for multiple students at once."""
    notifications = []
    for student in students:
        notifications.append(Notification(
            recipient=student.user,
            notification_type=notification_type,
            title=title,
            message=message,
            related_object_id=related_object_id,
        ))
    return Notification.objects.bulk_create(notifications)
