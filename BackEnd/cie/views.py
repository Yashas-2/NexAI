"""NexAI CIE – API Views"""
from django.db import models as django_models
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import (
    IsChiefSuperintendent, IsChiefSuperintendentOrHOD, IsHOD, IsStaff
)
from .models import CIEConfiguration, CIEMarks, AssignmentMarks, CIEQuestionPaperScrutiny
from .serializers import (
    CIEConfigurationSerializer, CIEMarksSerializer,
    AssignmentMarksSerializer, CIEQuestionPaperScrutinySerializer,
)
from .services import compute_cie_aggregate, compute_eligibility_from_cie
from users.constants import UserRole


# ─── CIE Configuration (HOD Creates / Views) ──────────────────────────────────

class CIEConfigListCreateView(generics.ListCreateAPIView):
    """
    GET  /cie/configs/  – List all CIE configs (filtered by HOD dept or faculty assignment)
    POST /cie/configs/  – HOD creates a new CIE config for a subject+session+CIE_number
    """
    serializer_class = CIEConfigurationSerializer
    permission_classes = [IsChiefSuperintendentOrHOD]

    def get_queryset(self):
        user = self.request.user
        qs = CIEConfiguration.objects.select_related(
            'subject', 'subject__department', 'exam_session', 'assigned_faculty'
        )
        if user.role == UserRole.HOD:
            dept = getattr(user, 'department', None)
            if dept:
                qs = qs.filter(subject__department=dept)
        # Filter by query params
        session_id = self.request.query_params.get('session')
        subject_id = self.request.query_params.get('subject')
        cie_num = self.request.query_params.get('cie_number')
        if session_id:
            qs = qs.filter(exam_session_id=session_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if cie_num:
            qs = qs.filter(cie_number=cie_num)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CIEConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /cie/configs/<id>/"""
    serializer_class = CIEConfigurationSerializer
    permission_classes = [IsChiefSuperintendentOrHOD]
    queryset = CIEConfiguration.objects.all()


class CIEConfigActivateView(APIView):
    """POST /cie/configs/<id>/activate/ – HOD activates a CIE for students"""
    permission_classes = [IsChiefSuperintendentOrHOD]

    def post(self, request, pk, *args, **kwargs):
        try:
            config = CIEConfiguration.objects.get(pk=pk)
        except CIEConfiguration.DoesNotExist:
            return Response({"error": "CIE config not found."}, status=status.HTTP_404_NOT_FOUND)

        # Department authorization
        if request.user.role == UserRole.HOD:
            dept = getattr(request.user, 'department', None)
            if dept and config.subject.department != dept:
                return Response({"error": "Not authorized for this department."}, status=status.HTTP_403_FORBIDDEN)

        config.is_active = True
        config.save(update_fields=['is_active'])
        return Response({"message": f"{config.cie_number} activated for {config.subject.code}."})

    def delete(self, request, pk, *args, **kwargs):
        """Deactivate (stop) a running CIE"""
        try:
            config = CIEConfiguration.objects.get(pk=pk)
        except CIEConfiguration.DoesNotExist:
            return Response({"error": "CIE config not found."}, status=status.HTTP_404_NOT_FOUND)
        config.is_active = False
        config.save(update_fields=['is_active'])
        return Response({"message": f"{config.cie_number} deactivated."})


# ─── CIE Marks (Faculty Enters / Views) ───────────────────────────────────────

class CIEMarksListView(generics.ListAPIView):
    """
    GET /cie/marks/?cie_config=<id>  – Faculty/HOD views marks for a CIE config
    """
    serializer_class = CIEMarksSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = CIEMarks.objects.select_related('student__user', 'cie_config__subject')
        config_id = self.request.query_params.get('cie_config')
        student_id = self.request.query_params.get('student')
        if config_id:
            qs = qs.filter(cie_config_id=config_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        # HOD sees only their dept; Faculty sees only assigned subjects
        if user.role == UserRole.HOD:
            dept = getattr(user, 'department', None)
            if dept:
                qs = qs.filter(cie_config__subject__department=dept)
        elif user.role == UserRole.FACULTY:
            qs = qs.filter(cie_config__assigned_faculty=user)
        return qs


class CIEMarksBulkUpsertView(APIView):
    """
    POST /cie/marks/bulk/
    Faculty submits marks for multiple students for a given CIE config.
    Body: { "cie_config": "<uuid>", "marks": [{"student": "<uuid>", "marks_awarded": 42.5, "is_absent": false, "remarks": ""}] }
    """
    permission_classes = [IsStaff]

    def post(self, request, *args, **kwargs):
        config_id = request.data.get('cie_config')
        marks_data = request.data.get('marks', [])

        if not config_id:
            return Response({"error": "cie_config is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            config = CIEConfiguration.objects.get(pk=config_id)
        except CIEConfiguration.DoesNotExist:
            return Response({"error": "CIE config not found."}, status=status.HTTP_404_NOT_FOUND)

        # Authorization: only assigned faculty or HOD of that dept
        user = request.user
        if user.role == UserRole.FACULTY and config.assigned_faculty != user:
            return Response({"error": "Not assigned to this CIE."}, status=status.HTTP_403_FORBIDDEN)
        if user.role == UserRole.HOD:
            dept = getattr(user, 'department', None)
            if dept and config.subject.department != dept:
                return Response({"error": "Not authorized for this department."}, status=status.HTTP_403_FORBIDDEN)

        created, updated, errors = 0, 0, []
        for entry in marks_data:
            student_id = entry.get('student')
            marks_awarded = entry.get('marks_awarded')
            is_absent = entry.get('is_absent', False)
            remarks = entry.get('remarks', '')

            if not student_id:
                errors.append("Missing student ID in entry.")
                continue

            try:
                from users.models import Student
                student = Student.objects.get(pk=student_id)
                mark_obj, was_created = CIEMarks.objects.update_or_create(
                    student=student,
                    cie_config=config,
                    defaults={
                        'marks_awarded': marks_awarded if not is_absent else 0,
                        'is_absent': is_absent,
                        'remarks': remarks,
                        'entered_by': user,
                    }
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception as e:
                errors.append(f"Student {student_id}: {str(e)}")

        return Response({
            "created": created,
            "updated": updated,
            "errors": errors,
        }, status=status.HTTP_200_OK)


# ─── Assignment Marks ──────────────────────────────────────────────────────────

class AssignmentMarksBulkView(APIView):
    """
    POST /cie/assignment-marks/bulk/
    Faculty submits assignment marks for multiple students.
    Body: { "subject": "<id>", "exam_session": "<id>", "marks": [{"student": "<id>", "marks_awarded": 8}] }
    """
    permission_classes = [IsStaff]

    def post(self, request, *args, **kwargs):
        subject_id = request.data.get('subject')
        session_id = request.data.get('exam_session')
        marks_data = request.data.get('marks', [])

        if not subject_id or not session_id:
            return Response({"error": "subject and exam_session are required."}, status=status.HTTP_400_BAD_REQUEST)

        created, updated, errors = 0, 0, []
        for entry in marks_data:
            student_id = entry.get('student')
            marks_awarded = entry.get('marks_awarded')
            if not student_id or marks_awarded is None:
                errors.append("Missing student or marks_awarded.")
                continue
            try:
                from users.models import Student
                student = Student.objects.get(pk=student_id)
                _, was_created = AssignmentMarks.objects.update_or_create(
                    student=student,
                    subject_id=subject_id,
                    exam_session_id=session_id,
                    defaults={'marks_awarded': marks_awarded, 'max_marks': 10, 'entered_by': request.user}
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception as e:
                errors.append(f"Student {student_id}: {str(e)}")

        return Response({"created": created, "updated": updated, "errors": errors})


# ─── CIE Aggregate ────────────────────────────────────────────────────────────

class CIEAggregateView(APIView):
    """
    GET /cie/aggregate/?student=<id>&subject=<id>&session=<id>
    Returns CIE breakdown (CIE1+2+3+Assignment) for a student/subject/session.
    """
    permission_classes = [IsStaff]

    def get(self, request, *args, **kwargs):
        student_id = request.query_params.get('student')
        subject_id = request.query_params.get('subject')
        session_id = request.query_params.get('session')

        if not all([student_id, subject_id, session_id]):
            return Response({"error": "student, subject, and session params are required."}, status=400)

        result = compute_cie_aggregate(student_id, subject_id, session_id)
        return Response(result)


class CIEEligibilityView(APIView):
    """
    GET /cie/eligibility/?student=<id>&subject=<id>&session=<id>
    Returns full eligibility determination (attendance + CIE).
    """
    permission_classes = [IsStaff]

    def get(self, request, *args, **kwargs):
        student_id = request.query_params.get('student')
        subject_id = request.query_params.get('subject')
        session_id = request.query_params.get('session')

        if not all([student_id, subject_id, session_id]):
            return Response({"error": "student, subject, and session params are required."}, status=400)

        result = compute_eligibility_from_cie(student_id, subject_id, session_id)
        return Response(result)


class CIEBulkEligibilityView(APIView):
    """
    POST /cie/eligibility/bulk/
    Compute eligibility for all enrolled students in a session for a given subject.
    Body: { "subject": "<id>", "session": "<id>" }
    Optionally update StudentEligibility records in-place.
    """
    permission_classes = [IsChiefSuperintendentOrHOD]

    def post(self, request, *args, **kwargs):
        subject_id = request.data.get('subject')
        session_id = request.data.get('session')
        update_records = request.data.get('update_eligibility_records', False)

        if not subject_id or not session_id:
            return Response({"error": "subject and session are required."}, status=400)

        from scheduling.models import StudentSubjectEnrollment
        enrollments = StudentSubjectEnrollment.objects.filter(
            subject_id=subject_id, exam_session_id=session_id
        ).select_related('student')

        results = []
        for enr in enrollments:
            elig = compute_eligibility_from_cie(str(enr.student.id), subject_id, session_id)
            results.append(elig)

            if update_records and 'error' not in elig:
                from eligibility.models import StudentEligibility
                StudentEligibility.objects.update_or_create(
                    student=enr.student,
                    subject_id=subject_id,
                    exam_session_id=session_id,
                    defaults={
                        'is_eligible': elig.get('is_eligible', False),
                        'is_condonable': elig.get('is_condonable', False),
                        'cie_marks_avg': elig.get('cie_average') or 0,
                    }
                )

        return Response({
            "total": len(results),
            "eligible": sum(1 for r in results if r.get('is_eligible')),
            "condonable": sum(1 for r in results if r.get('is_condonable')),
            "detained": sum(1 for r in results if r.get('is_detained')),
            "results": results,
        })


# ─── Question Paper Scrutiny ──────────────────────────────────────────────────

class CIEScrutinyListCreateView(generics.ListCreateAPIView):
    """
    GET  /cie/scrutiny/  – HOD views papers to review; Faculty views their own submissions
    POST /cie/scrutiny/  – Faculty submits a question paper for HOD scrutiny
    """
    serializer_class = CIEQuestionPaperScrutinySerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = CIEQuestionPaperScrutiny.objects.select_related(
            'cie_config__subject__department', 'submitted_by', 'reviewed_by'
        )
        if user.role == UserRole.HOD:
            dept = getattr(user, 'department', None)
            if dept:
                qs = qs.filter(cie_config__subject__department=dept)
        elif user.role == UserRole.FACULTY:
            qs = qs.filter(submitted_by=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            submitted_by=self.request.user,
            submitted_at=timezone.now(),
            status=CIEQuestionPaperScrutiny.ScrutinyStatus.PENDING,
        )


class CIEScrutinyDetailView(generics.RetrieveUpdateAPIView):
    """GET/PUT/PATCH /cie/scrutiny/<id>/"""
    serializer_class = CIEQuestionPaperScrutinySerializer
    permission_classes = [IsStaff]
    queryset = CIEQuestionPaperScrutiny.objects.all()


class CIEScrutinyApproveView(APIView):
    """POST /cie/scrutiny/<id>/approve/ – HOD approves a CIE question paper"""
    permission_classes = [IsHOD]

    def post(self, request, pk, *args, **kwargs):
        try:
            scrutiny = CIEQuestionPaperScrutiny.objects.get(pk=pk)
        except CIEQuestionPaperScrutiny.DoesNotExist:
            return Response({"error": "Scrutiny record not found."}, status=404)

        dept = getattr(request.user, 'department', None)
        if dept and scrutiny.cie_config.subject.department != dept:
            return Response({"error": "Not authorized for this department."}, status=403)

        scrutiny.status = CIEQuestionPaperScrutiny.ScrutinyStatus.APPROVED
        scrutiny.reviewed_by = request.user
        scrutiny.reviewed_at = timezone.now()
        scrutiny.review_note = request.data.get('note', '')
        scrutiny.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note'])

        return Response({
            "message": f"Paper '{scrutiny.paper_title}' approved by HOD.",
            "status": scrutiny.status,
        })


class CIEScrutinyRejectView(APIView):
    """POST /cie/scrutiny/<id>/reject/ – HOD rejects a CIE question paper"""
    permission_classes = [IsHOD]

    def post(self, request, pk, *args, **kwargs):
        try:
            scrutiny = CIEQuestionPaperScrutiny.objects.get(pk=pk)
        except CIEQuestionPaperScrutiny.DoesNotExist:
            return Response({"error": "Scrutiny record not found."}, status=404)

        note = request.data.get('note', '')
        if not note:
            return Response({"error": "A rejection note/reason is required."}, status=400)

        dept = getattr(request.user, 'department', None)
        if dept and scrutiny.cie_config.subject.department != dept:
            return Response({"error": "Not authorized for this department."}, status=403)

        scrutiny.status = CIEQuestionPaperScrutiny.ScrutinyStatus.REJECTED
        scrutiny.reviewed_by = request.user
        scrutiny.reviewed_at = timezone.now()
        scrutiny.review_note = note
        scrutiny.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note'])

        return Response({
            "message": f"Paper '{scrutiny.paper_title}' rejected.",
            "note": note,
        })

from rest_framework import viewsets
from rest_framework.decorators import action
from .models import CIEAttempt, CIEAnswer
from .serializers import CIEAttemptSerializer, CIEAnswerSerializer

class CIETestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for students taking CIE tests digitally.
    """
    serializer_class = CIEAttemptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.STUDENT:
            return CIEAttempt.objects.filter(student=user.student_profile)
        return CIEAttempt.objects.none()

    @action(detail=False, methods=['post'])
    def start_exam(self, request):
        user = request.user
        if user.role != UserRole.STUDENT:
            return Response({"error": "Only students can start an exam."}, status=403)
            
        cie_config_id = request.data.get("cie_config_id")
        
        try:
            cie_config = CIEConfiguration.objects.get(id=cie_config_id)
        except CIEConfiguration.DoesNotExist:
            return Response({"error": "Invalid CIE Configuration."}, status=404)
            
        if not cie_config.is_active:
            return Response({"error": "This CIE is not currently active."}, status=403)
            
        attempt, created = CIEAttempt.objects.get_or_create(
            student=user.student_profile,
            cie_config=cie_config
        )
        
        serializer = self.get_serializer(attempt)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def save_answer(self, request, pk=None):
        attempt = self.get_object()
        
        if attempt.is_locked:
            return Response({"error": "Exam is locked and already submitted."}, status=403)
            
        question_text = request.data.get("question_text", "")
        answer_text = request.data.get("answer_text", "")
        
        answer, created = CIEAnswer.objects.update_or_create(
            attempt=attempt,
            question_text=question_text,
            defaults={"answer_text": answer_text}
        )
        
        return Response({"status": "Answer saved"})

    @action(detail=True, methods=['post'])
    def submit_exam(self, request, pk=None):
        attempt = self.get_object()
        
        if attempt.is_locked:
            return Response({"error": "Already submitted."}, status=400)
            
        attempt.is_locked = True
        attempt.submitted_at = timezone.now()
        attempt.save()
        
        return Response({"status": "Exam submitted successfully"})
