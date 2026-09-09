"""NexAI Scanning – Views"""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from core.permissions import IsInvigilator, IsChiefSuperintendent
from .models import ScanningSession, BookletPacket
from .serializers import ScanningSessionSerializer, BookletPacketSerializer
from .tasks import process_booklet_packet


class ScanningSessionViewSet(viewsets.ModelViewSet):
    """
    INVIGILATOR creates and manages scanning sessions for a timetable slot.
    COE can view all sessions.
    """
    serializer_class = ScanningSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "CHIEF_SUPERINTENDENT":
            return ScanningSession.objects.all()
        if user.role == "INVIGILATOR":
            return ScanningSession.objects.filter(invigilator=user)
        return ScanningSession.objects.none()

    def perform_create(self, serializer):
        serializer.save(invigilator=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsInvigilator])
    def activate(self, request, pk=None):
        """Invigilator activates a pending session, starting the upload window."""
        session = self.get_object()
        if session.status != ScanningSession.SessionStatus.PENDING:
            return Response(
                {"error": "Only PENDING sessions can be activated."},
                status=status.HTTP_400_BAD_REQUEST
            )
        session.status = ScanningSession.SessionStatus.ACTIVE
        session.activated_at = timezone.now()
        session.save(update_fields=['status', 'activated_at'])
        return Response({"status": "activated", "session_token": str(session.session_token)})

    @action(detail=True, methods=['post'], permission_classes=[IsInvigilator])
    def close(self, request, pk=None):
        """Invigilator manually closes an active scanning session."""
        session = self.get_object()
        if session.status != ScanningSession.SessionStatus.ACTIVE:
            return Response(
                {"error": "Only ACTIVE sessions can be closed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        session.status = ScanningSession.SessionStatus.CLOSED
        session.save(update_fields=['status'])
        return Response({"status": "closed"})


class BookletPacketViewSet(viewsets.ModelViewSet):
    """
    INVIGILATOR uploads scanned booklets within an active ScanningSession.
    Each upload triggers a Celery task to link the booklet to the correct student.
    """
    serializer_class = BookletPacketSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        if user.role == "CHIEF_SUPERINTENDENT":
            return BookletPacket.objects.all()
        if user.role == "INVIGILATOR":
            return BookletPacket.objects.filter(scanning_session__invigilator=user)
        return BookletPacket.objects.none()

    def create(self, request, *args, **kwargs):
        """
        Upload a single scanned booklet.
        Validates the session is ACTIVE before accepting the upload.
        """
        session_id = request.data.get('scanning_session')
        try:
            session = ScanningSession.objects.get(id=session_id, invigilator=request.user)
        except ScanningSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        if session.status != ScanningSession.SessionStatus.ACTIVE:
            return Response(
                {"error": "Session is not active. Activate the session before uploading."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        packet = serializer.save()

        # Dispatch background task to link booklet to student
        process_booklet_packet.delay(str(packet.id))

        return Response(serializer.data, status=status.HTTP_201_CREATED)
