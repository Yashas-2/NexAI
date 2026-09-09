"""NexAI Notifications – Views"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Each user can only see their own notifications.
    Provides actions to mark notifications as read.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only notifications for the currently authenticated user."""
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        return Response({"status": "marked as read"})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all of the current user's unread notifications as read."""
        now = timezone.now()
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True, read_at=now)
        return Response({"status": "all marked as read", "updated_count": updated})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Return the count of unread notifications (used by the frontend badge)."""
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})
