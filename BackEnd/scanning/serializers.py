"""NexAI Scanning – Serializers"""
from rest_framework import serializers
from .models import ScanningSession, BookletPacket


class BookletPacketSerializer(serializers.ModelSerializer):
    """Serializer for individual scanned answer booklets."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BookletPacket
        fields = [
            'id', 'scanning_session', 'student', 'student_usn',
            'booklet_file', 'page_count', 'status', 'status_display',
            'uploaded_at', 'processed_at', 'error_message',
        ]
        read_only_fields = ['id', 'student', 'status', 'processed_at', 'error_message', 'uploaded_at']


class ScanningSessionSerializer(serializers.ModelSerializer):
    """Serializer for a scanning session opened by an invigilator."""
    invigilator_name = serializers.CharField(source='invigilator.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    booklet_count = serializers.SerializerMethodField()

    class Meta:
        model = ScanningSession
        fields = [
            'id', 'timetable_slot', 'invigilator', 'invigilator_name',
            'session_token', 'geofence_lat', 'geofence_lng', 'geofence_radius_m',
            'status', 'status_display', 'booklet_count',
            'activated_at', 'expires_at', 'created_at',
        ]
        read_only_fields = ['id', 'session_token', 'activated_at', 'created_at']

    def get_booklet_count(self, obj):
        return obj.booklet_packets.count()
