from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ProctoringSession, ProctoringEvent
from .serializers import ProctoringSessionSerializer
from .ai_engine import detect_anomalies
from users.models import Student

class ProctoringSessionViewSet(viewsets.ModelViewSet):
    queryset = ProctoringSession.objects.all()
    serializer_class = ProctoringSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "STUDENT":
            return ProctoringSession.objects.filter(student__user=user)
        elif user.role in ["CHIEF_SUPERINTENDENT", "HOD", "INVIGILATOR"]:
            return ProctoringSession.objects.all()
        return ProctoringSession.objects.none()

    @action(detail=False, methods=['post'])
    def start_session(self, request):
        """
        Student initiates a proctoring session for a TimetableSlot.
        """
        user = request.user
        if user.role != "STUDENT":
            return Response({"error": "Only students can start a session."}, status=status.HTTP_403_FORBIDDEN)
            
        timetable_slot_id = request.data.get('timetable_slot_id')
        if not timetable_slot_id:
            return Response({"error": "timetable_slot_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            student = Student.objects.get(user=user)
        except Student.DoesNotExist:
            return Response({"error": "Student profile not found."}, status=status.HTTP_404_NOT_FOUND)

        session = ProctoringSession.objects.create(
            student=student,
            timetable_slot_id=timetable_slot_id
        )
        
        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def upload_frame(self, request, pk=None):
        """
        Student app uploads a frame periodically (e.g. every 3s).
        The frame is passed to the AI engine for anomaly detection.
        """
        session = self.get_object()

        if not session.is_active:
            return Response({"error": "Session is not active."}, status=status.HTTP_400_BAD_REQUEST)

        # Read actual frame bytes from the uploaded file
        frame_file = request.FILES.get('frame')
        if not frame_file:
            return Response({"error": "No frame file provided. Send the image as 'frame' in multipart/form-data."}, status=status.HTTP_400_BAD_REQUEST)

        frame_bytes = frame_file.read()
        anomalies = detect_anomalies(frame_bytes)

        events_created = []
        for anomaly in anomalies:
            event = ProctoringEvent.objects.create(
                session=session,
                event_type=anomaly['event_type'],
                severity=anomaly['severity'],
                screenshot_url=anomaly['screenshot_url']
            )
            events_created.append(event)

        return Response({
            "status": "frame_processed",
            "anomalies_detected": len(events_created)
        })

    @action(detail=False, methods=['get'])
    def live_radar(self, request):
        """
        CoE endpoint to fetch live radar data.
        Returns active sessions and their flag counts.
        """
        if request.user.role not in ["CHIEF_SUPERINTENDENT", "HOD", "INVIGILATOR"]:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
            
        active_sessions = ProctoringSession.objects.filter(is_active=True).prefetch_related('events')
        
        radar_data = []
        for session in active_sessions:
            events = session.events.all()
            radar_data.append({
                "session_id": str(session.id),
                "student_usn": session.student.usn,
                "timetable_slot": str(session.timetable_slot.id),
                "high_severity_flags": events.filter(severity="HIGH").count(),
                "medium_severity_flags": events.filter(severity="MEDIUM").count(),
                "low_severity_flags": events.filter(severity="LOW").count(),
                "total_flags": events.count(),
                "latest_event": events.first().event_type if events.exists() else None
            })
            
        # Sort by high severity flags descending
        radar_data.sort(key=lambda x: x['high_severity_flags'], reverse=True)
        
        return Response(radar_data)
