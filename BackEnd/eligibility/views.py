"""NexAI - Eligibility API Views"""
from rest_framework import viewsets, views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsHOD, IsStudent
from users.constants import UserRole
from .models import StudentEligibility, HallTicket
from .serializers import (
    StudentEligibilitySerializer, HallTicketSerializer,
    BulkEligibilityUploadSerializer
)
from .tasks import process_eligibility_csv, generate_hall_tickets_for_session
from scheduling.models import ExamSession


from decimal import Decimal

class StudentEligibilityViewSet(viewsets.ModelViewSet):
    """
    HOD can view eligibility records for their department only.
    COE/Admin can see all records.
    Student can only view their own records.
    """
    serializer_class = StudentEligibilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'student_profile'):
            return StudentEligibility.objects.filter(student=user.student_profile)
        # HOD sees only their department's records
        qs = StudentEligibility.objects.all()
        if user.role == UserRole.HOD and user.department:
            qs = qs.filter(student__department=user.department)
        # COE/Admin sees all records (no department filter)
        session_id = self.request.query_params.get('session_id')
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        return qs

    def _calculate_eligibility(self, serializer):
        if 'is_eligible' in serializer.validated_data:
            serializer.save()
            return

        instance = serializer.instance
        attendance = serializer.validated_data.get('attendance_percentage')
        if attendance is None and instance:
            attendance = instance.attendance_percentage
        elif attendance is None:
            attendance = Decimal('0')

        cie1 = serializer.validated_data.get('cie1_marks')
        if cie1 is None and instance:
            cie1 = instance.cie1_marks
        cie1 = cie1 or Decimal('0')

        cie2 = serializer.validated_data.get('cie2_marks')
        if cie2 is None and instance:
            cie2 = instance.cie2_marks
        cie2 = cie2 or Decimal('0')

        cie3 = serializer.validated_data.get('cie3_marks')
        if cie3 is None and instance:
            cie3 = instance.cie3_marks
        cie3 = cie3 or Decimal('0')

        assignment = serializer.validated_data.get('assignment_marks')
        if assignment is None and instance:
            assignment = instance.assignment_marks
        assignment = assignment or Decimal('0')

        # Average of 3 CIEs plus Assignment
        calculated_cie = ((cie1 + cie2 + cie3) / Decimal('3')) + assignment

        is_eligible = True
        remarks = []
        if attendance < Decimal("75.00"):
            is_eligible = False
            remarks.append(f"Shortage of attendance ({attendance}%)")
        if calculated_cie < Decimal("40.00"):
            is_eligible = False
            remarks.append(f"Low CIE marks ({calculated_cie:.2f})")
        serializer.save(
            is_eligible=is_eligible,
            remarks=" | ".join(remarks),
            cie_marks=calculated_cie
        )

    def perform_create(self, serializer):
        self._calculate_eligibility(serializer)

    def perform_update(self, serializer):
        self._calculate_eligibility(serializer)


class HallTicketViewSet(viewsets.ReadOnlyModelViewSet):
    """
    HOD can view all hall tickets.
    Student can only view their own hall ticket.
    """
    serializer_class = HallTicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'student_profile'):
            return HallTicket.objects.filter(student=user.student_profile, is_revoked=False)
        qs = HallTicket.objects.all()
        session_id = self.request.query_params.get('session_id')
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        return qs


class BulkEligibilityUploadView(views.APIView):
    """
    Accepts a CSV upload and triggers Celery task.
    HOD can only upload records for their department.
    COE/Admin can upload for any department.
    """
    permission_classes = [IsHOD]

    def post(self, request, *args, **kwargs):
        serializer = BulkEligibilityUploadSerializer(data=request.data)
        if serializer.is_valid():
            file_obj = serializer.validated_data['file']
            session_id = serializer.validated_data.get('exam_session_id')
            
            if not session_id:
                from scheduling.models import ExamSession
                active_session = ExamSession.objects.filter(status='ACTIVE').first() or ExamSession.objects.filter(status__in=['SCHEDULED', 'DRAFT']).first() or ExamSession.objects.first()
                if not active_session:
                    return Response({"error": "No exam session found. Please create an exam session first."}, status=status.HTTP_400_BAD_REQUEST)
                session_id = active_session.id
            
            # Read file content as string
            try:
                file_content = file_obj.read().decode('utf-8')
            except Exception as e:
                return Response({"error": "Failed to read CSV. Ensure it is UTF-8 encoded."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Restrict HOD to their department only
            user = request.user
            dept_id = str(user.department.id) if user.role == UserRole.HOD and user.department else None
            
            from eligibility.tasks import process_eligibility_csv
            result = process_eligibility_csv(file_content, str(session_id), dept_id)
            
            return Response({
                "message": "CSV upload accepted and processed successfully.",
                "result": result
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GenerateHallTicketsView(views.APIView):
    """
    Triggers generation of Hall Tickets for an Exam Session.
    """
    permission_classes = [IsHOD]

    def post(self, request, session_id):
        # Verify session exists
        if not ExamSession.objects.filter(id=session_id).exists():
            return Response({"error": "Exam Session not found."}, status=status.HTTP_404_NOT_FOUND)
            
        result = generate_hall_tickets_for_session(session_id)
        if result.get("status") == "error":
            return Response({"error": result.get("message")}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            "message": "Hall ticket generation task queued.",
            "result": result
        }, status=status.HTTP_200_OK)


class GenerateEligibilityView(views.APIView):
    """
    Computes eligibility for all StudentEligibility records for the HOD's department.
    """
    permission_classes = [IsHOD]

    def post(self, request):
        user = request.user
        if not user.department:
            return Response({"error": "No department associated with this HOD."}, status=status.HTTP_400_BAD_REQUEST)
        
        records = StudentEligibility.objects.filter(student__department=user.department)
        
        session_id = request.data.get("session_id")
        if session_id:
            records = records.filter(exam_session_id=session_id)
            
        updated_count = 0
        updated_sessions = set()

        for record in records:
            cie1 = record.cie1_marks or Decimal('0')
            cie2 = record.cie2_marks or Decimal('0')
            cie3 = record.cie3_marks or Decimal('0')
            assignment = record.assignment_marks or Decimal('0')
            attendance = record.attendance_percentage or Decimal('0')

            calculated_cie = ((cie1 + cie2 + cie3) / Decimal('3')) + assignment

            is_eligible = True
            remarks = []
            if attendance < Decimal("75.00"):
                is_eligible = False
                remarks.append(f"Shortage of attendance ({attendance}%)")
            if calculated_cie < Decimal("40.00"):
                is_eligible = False
                remarks.append(f"Low CIE marks ({calculated_cie:.2f})")

            record.is_eligible = is_eligible
            record.remarks = " | ".join(remarks)
            record.cie_marks = calculated_cie
            record.save()
            updated_sessions.add(record.exam_session_id)
            updated_count += 1

        # Notify ineligible students
        from notifications.helpers import notify_user
        ineligible = StudentEligibility.objects.filter(
            student__department=user.department, is_eligible=False
        ).select_related("student__user", "exam_session")
        
        if session_id:
            ineligible = ineligible.filter(exam_session_id=session_id)
            
        for rec in ineligible:
            notify_user(
                rec.student.user,
                "ELIGIBILITY_UPDATE",
                "Eligibility Alert",
                f"You are NOT eligible for {rec.exam_session.name} – {rec.subject.code}. Reason: {rec.remarks}",
                related_object_id=rec.exam_session.id,
            )

        # Auto-activate CIE sessions
        for sid in updated_sessions:
            if sid:
                session = ExamSession.objects.get(id=sid)
                if 'CIE' in session.name.upper():
                    from eligibility.tasks import generate_hall_tickets_for_session
                    generate_hall_tickets_for_session(sid)
                    if session.status != 'ACTIVE':
                        session.status = 'ACTIVE'
                        session.save(update_fields=['status'])

        return Response({
            "message": f"Successfully computed eligibility for {updated_count} records.",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)
