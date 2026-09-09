from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AnswerScript, ScriptPage, QuestionGrade
from .serializers import AnswerScriptSerializer, ScriptPageSerializer, QuestionGradeSerializer
from .tasks import process_answer_script_task

class AnswerScriptViewSet(viewsets.ModelViewSet):
    queryset = AnswerScript.objects.all()
    serializer_class = AnswerScriptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "INVIGILATOR":
            return AnswerScript.objects.filter(uploaded_by=user)
        elif user.role in ["EVALUATOR", "SCRUTINIZER"]:
            return AnswerScript.objects.filter(assigned_evaluator=user)
        elif user.role == "CHIEF_SUPERINTENDENT":
            return AnswerScript.objects.all()
        return AnswerScript.objects.none()

    @action(detail=True, methods=['post'])
    def upload_page(self, request, pk=None):
        """
        Invigilator uploads a single scanned page of the script.
        """
        script = self.get_object()
        if script.upload_complete:
            return Response({"error": "Upload is already marked as complete."}, status=status.HTTP_400_BAD_REQUEST)

        # In reality we would save the file to S3 and generate a URL
        # For simulation, we'll just increment page count and save a dummy URL
        page_number = script.page_count + 1
        dummy_url = f"https://nexai-mock-bucket.s3.amazonaws.com/scripts/{script.id}/page_{page_number}.jpg"
        
        ScriptPage.objects.create(
            answer_script=script,
            page_number=page_number,
            s3_url=dummy_url,
            quality_score=15.0
        )
        
        script.page_count = page_number
        script.save()

        return Response({"status": "page uploaded", "page_number": page_number})

    @action(detail=True, methods=['post'])
    def complete_upload(self, request, pk=None):
        """
        Invigilator finalizes the upload. Triggers the AI Auto-Evaluation.
        """
        script = self.get_object()
        if script.upload_complete:
            return Response({"error": "Already complete."}, status=status.HTTP_400_BAD_REQUEST)

        script.upload_complete = True
        script.upload_completed_at = timezone.now()
        script.save()

        # Trigger Celery Task
        process_answer_script_task.delay(script.id)

        return Response({"status": "upload completed, AI evaluation triggered."})

    @action(detail=True, methods=['post'])
    def submit_grade(self, request, pk=None):
        """
        Evaluator submits the final grade for a specific question.
        Expects {"question_id": UUID, "evaluator_score": float, "override_reason": str}
        """
        script = self.get_object()
        user = request.user

        if script.assigned_evaluator != user:
            return Response({"error": "You are not assigned to this script."}, status=status.HTTP_403_FORBIDDEN)

        question_id = request.data.get('question_id')
        score = request.data.get('evaluator_score')
        reason = request.data.get('override_reason', '')

        try:
            grade = QuestionGrade.objects.get(answer_script=script, question_id=question_id)
        except QuestionGrade.DoesNotExist:
            return Response({"error": "Question grade record not found."}, status=status.HTTP_404_NOT_FOUND)

        grade.evaluator_score = score
        grade.evaluator = user
        grade.override_reason = reason
        grade.evaluated_at = timezone.now()
        grade.save()

        # Recalculate total evaluator score
        total = sum(g.evaluator_score for g in script.question_grades.all() if g.evaluator_score is not None)
        script.evaluator_total_score = total
        script.save()
        return Response({"status": "grade saved", "evaluator_total_score": total})


from .models import EvaluationBundle
from .serializers import EvaluationBundleSerializer

class EvaluationBundleViewSet(viewsets.ModelViewSet):
    queryset = EvaluationBundle.objects.all()
    serializer_class = EvaluationBundleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["EVALUATOR", "SCRUTINIZER", "FACULTY"]:
            return EvaluationBundle.objects.filter(evaluator=user)
        elif user.role in ["CHIEF_SUPERINTENDENT", "HOD"]:
            return EvaluationBundle.objects.all()
        return EvaluationBundle.objects.none()

    @action(detail=False, methods=['post'])
    def auto_bundle(self, request):
        """
        Creates bundles of 30 AnswerScripts and assigns them to available evaluators.
        """
        session_id = request.data.get("exam_session_id")
        subject_id = request.data.get("subject_id")
        
        unassigned_scripts = AnswerScript.objects.filter(
            question_paper__exam_session_id=session_id,
            question_paper__subject_id=subject_id,
            evaluation_bundle__isnull=True,
            status="UPLOADED"
        )
        
        bundle_size = 30
        created_bundles = 0
        scripts_bundled = 0
        
        current_bundle = None
        for i, script in enumerate(unassigned_scripts):
            if i % bundle_size == 0:
                current_bundle = EvaluationBundle.objects.create(
                    name=f"Bundle {created_bundles + 1} - Subject {subject_id}",
                    subject_id=subject_id,
                    exam_session_id=session_id,
                )
                created_bundles += 1
                
            script.evaluation_bundle = current_bundle
            script.status = "ASSIGNED"
            script.save()
            scripts_bundled += 1
            
        return Response({
            "message": f"Created {created_bundles} bundles containing {scripts_bundled} scripts.",
            "bundles_created": created_bundles,
            "scripts_bundled": scripts_bundled
        })

    @action(detail=True, methods=['post'])
    def assign_evaluator(self, request, pk=None):
        bundle = self.get_object()
        evaluator_id = request.data.get("evaluator_id")
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AnswerScript, ScriptPage, QuestionGrade
from .serializers import AnswerScriptSerializer, ScriptPageSerializer, QuestionGradeSerializer
from .tasks import process_answer_script_task

class AnswerScriptViewSet(viewsets.ModelViewSet):
    queryset = AnswerScript.objects.all()
    serializer_class = AnswerScriptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "INVIGILATOR":
            return AnswerScript.objects.filter(uploaded_by=user)
        elif user.role in ["EVALUATOR", "SCRUTINIZER"]:
            return AnswerScript.objects.filter(assigned_evaluator=user)
        elif user.role == "CHIEF_SUPERINTENDENT":
            return AnswerScript.objects.all()
        return AnswerScript.objects.none()

    @action(detail=True, methods=['post'])
    def upload_page(self, request, pk=None):
        """
        Invigilator uploads a single scanned page of the script.
        """
        script = self.get_object()
        if script.upload_complete:
            return Response({"error": "Upload is already marked as complete."}, status=status.HTTP_400_BAD_REQUEST)

        # In reality we would save the file to S3 and generate a URL
        # For simulation, we'll just increment page count and save a dummy URL
        page_number = script.page_count + 1
        dummy_url = f"https://nexai-mock-bucket.s3.amazonaws.com/scripts/{script.id}/page_{page_number}.jpg"
        
        ScriptPage.objects.create(
            answer_script=script,
            page_number=page_number,
            s3_url=dummy_url,
            quality_score=15.0
        )
        
        script.page_count = page_number
        script.save()

        return Response({"status": "page uploaded", "page_number": page_number})

    @action(detail=True, methods=['post'])
    def complete_upload(self, request, pk=None):
        """
        Invigilator finalizes the upload. Triggers the AI Auto-Evaluation.
        """
        script = self.get_object()
        if script.upload_complete:
            return Response({"error": "Already complete."}, status=status.HTTP_400_BAD_REQUEST)

        script.upload_complete = True
        script.upload_completed_at = timezone.now()
        script.save()

        # Trigger Celery Task
        process_answer_script_task.delay(script.id)

        return Response({"status": "upload completed, AI evaluation triggered."})

    @action(detail=True, methods=['post'])
    def submit_grade(self, request, pk=None):
        """
        Evaluator submits the final grade for a specific question.
        Expects {"question_id": UUID, "evaluator_score": float, "override_reason": str}
        """
        script = self.get_object()
        user = request.user

        if script.assigned_evaluator != user:
            return Response({"error": "You are not assigned to this script."}, status=status.HTTP_403_FORBIDDEN)

        question_id = request.data.get('question_id')
        score = request.data.get('evaluator_score')
        reason = request.data.get('override_reason', '')

        try:
            grade = QuestionGrade.objects.get(answer_script=script, question_id=question_id)
        except QuestionGrade.DoesNotExist:
            return Response({"error": "Question grade record not found."}, status=status.HTTP_404_NOT_FOUND)

        grade.evaluator_score = score
        grade.evaluator = user
        grade.override_reason = reason
        grade.evaluated_at = timezone.now()
        grade.save()

        # Recalculate total evaluator score
        total = sum(g.evaluator_score for g in script.question_grades.all() if g.evaluator_score is not None)
        script.evaluator_total_score = total
        script.save()
        return Response({"status": "grade saved", "evaluator_total_score": total})


from .models import EvaluationBundle
from .serializers import EvaluationBundleSerializer

class EvaluationBundleViewSet(viewsets.ModelViewSet):
    queryset = EvaluationBundle.objects.all()
    serializer_class = EvaluationBundleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["EVALUATOR", "SCRUTINIZER", "FACULTY"]:
            return EvaluationBundle.objects.filter(evaluator=user)
        elif user.role in ["CHIEF_SUPERINTENDENT", "HOD"]:
            return EvaluationBundle.objects.all()
        return EvaluationBundle.objects.none()

    @action(detail=False, methods=['post'])
    def auto_bundle(self, request):
        """
        Creates bundles of 30 AnswerScripts and assigns them to available evaluators.
        """
        session_id = request.data.get("exam_session_id")
        subject_id = request.data.get("subject_id")
        
        unassigned_scripts = AnswerScript.objects.filter(
            question_paper__exam_session_id=session_id,
            question_paper__subject_id=subject_id,
            evaluation_bundle__isnull=True,
            status="UPLOADED"
        )
        
        bundle_size = 30
        created_bundles = 0
        scripts_bundled = 0
        
        current_bundle = None
        for i, script in enumerate(unassigned_scripts):
            if i % bundle_size == 0:
                current_bundle = EvaluationBundle.objects.create(
                    name=f"Bundle {created_bundles + 1} - Subject {subject_id}",
                    subject_id=subject_id,
                    exam_session_id=session_id,
                )
                created_bundles += 1
                
            script.evaluation_bundle = current_bundle
            script.status = "ASSIGNED"
            script.save()
            scripts_bundled += 1
            
        return Response({
            "message": f"Created {created_bundles} bundles containing {scripts_bundled} scripts.",
            "bundles_created": created_bundles,
            "scripts_bundled": scripts_bundled
        })

    @action(detail=True, methods=['post'])
    def assign_evaluator(self, request, pk=None):
        bundle = self.get_object()
        evaluator_id = request.data.get("evaluator_id")
        from users.models import User
        try:
            evaluator = User.objects.get(id=evaluator_id)
            bundle.evaluator = evaluator
            bundle.save()
            
            # Update all scripts in the bundle
            AnswerScript.objects.filter(evaluation_bundle=bundle).update(assigned_evaluator=evaluator)
            return Response({"message": f"Bundle assigned to {evaluator.full_name}"})
        except User.DoesNotExist:
            return Response({"error": "Evaluator not found"}, status=status.HTTP_404_NOT_FOUND)

class ResultPublishViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def publish_results(self, request):
        user = request.user
        if user.role not in ["COE", "CHIEF_SUPERINTENDENT"]:
            return Response({"error": "Only CoE can publish results"}, status=status.HTTP_403_FORBIDDEN)
            
        session_id = request.data.get("exam_session_id")
        subject_id = request.data.get("subject_id")
        
        if not session_id or not subject_id:
            return Response({"error": "exam_session_id and subject_id are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from student.models import Result
        from .models import AnswerScriptKeyMap
        from scheduling.models import Subject, ExamSession
        from eligibility.models import StudentEligibility
        
        try:
            subject = Subject.objects.get(id=subject_id)
            exam_session = ExamSession.objects.get(id=session_id)
        except (Subject.DoesNotExist, ExamSession.DoesNotExist):
            return Response({"error": "Invalid subject or session"}, status=status.HTTP_404_NOT_FOUND)
            
        # Get all completed scripts for this session and subject
        completed_scripts = AnswerScript.objects.filter(
            question_paper__exam_session=exam_session,
            question_paper__subject=subject,
            status="COMPLETED"
        )
        
        results_created = 0
        results_updated = 0
        
        for script in completed_scripts:
            try:
                keymap = AnswerScriptKeyMap.objects.get(answer_script=script)
                student = keymap.student
                
                eligibility = StudentEligibility.objects.filter(
                    student=student, 
                    subject=subject, 
                    exam_session=exam_session
                ).first()
                cie_marks = eligibility.cie_marks if eligibility and eligibility.cie_marks else 0.00
                
                result, created = Result.objects.get_or_create(
                    student=student,
                    subject=subject,
                    exam_session=exam_session,
                    defaults={'cie_marks': cie_marks}
                )
                
                # Ensure we have the latest CIE marks and SEE marks
                result.cie_marks = cie_marks
                result.see_marks = script.evaluator_total_score or script.ai_total_score or 0
                result.save()
                
                if created:
                    results_created += 1
                else:
                    results_updated += 1
                    
                # Mark as finalized
                script.status = "FINALIZED"
                script.save()
                
            except AnswerScriptKeyMap.DoesNotExist:
                continue
                
        return Response({
            "message": "Results published successfully",
            "results_created": results_created,
            "results_updated": results_updated
        })

    def _notify_results_published(self, exam_session, subject, results_created):
        """Send notifications to students whose results were published."""
        from notifications.helpers import notify_students_bulk
        from student.models import Result
        published_students = []
        for r in Result.objects.filter(
            exam_session=exam_session, subject=subject
        ).select_related("student"):
            published_students.append(r.student)
        if published_students:
            notify_students_bulk(
                published_students,
                "RESULT_PUBLISHED",
                f"Result Published – {subject.code}",
                f"Your result for {subject.code} ({exam_session.name}) has been published. Check the Results section.",
                related_object_id=exam_session.id,
            )
