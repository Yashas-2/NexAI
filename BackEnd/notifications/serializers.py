"""NexAI Notifications – Serializers"""
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'notification_type_display',
            'title', 'message', 'is_read', 'related_object_id',
            'created_at', 'read_at',
        ]
        read_only_fields = ['id', 'created_at', 'read_at']
