from django.db import models
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
from users.constants import UserRole
from student.models import SEEAttempt, SEEAnswer, Result


class EvaluationBundleViewSet(viewsets.ModelViewSet):
    """Evaluation bundles — the Main Evaluator / Bundle Custodian pipeline.

    Lifecycle: CREATED → ASSIGNED → IN_PROGRESS → COMPLETED
               → VERIFIED → CERTIFIED → DISPATCHED
    """
    queryset = EvaluationBundle.objects.all()
    serializer_class = EvaluationBundleSerializer
    permission_classes = [IsAuthenticated]

    _MAIN_EVALUATOR_ROLES = (UserRole.SCRUTINIZER, "CHIEF_SUPERINTENDENT")

    def perform_create(self, serializer):
        # Students never distribute valuation work; faculty/coordinator,
        # HOD and CoE do (authorization for viewing lives in get_queryset).
        if self.request.user.role == UserRole.STUDENT:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only staff can create valuation bundles.")
        data = serializer.validated_data
        # A bundle created without an evaluator starts as CREATED (unassigned);
        # with an evaluator it is ASSIGNED immediately.
        if "status" not in data:
            serializer.save(status="ASSIGNED" if data.get("evaluator") else "CREATED")
        else:
            serializer.save()

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.EVALUATOR:
            # Evaluators only ever see bundles assigned to them.
            return EvaluationBundle.objects.filter(evaluator=user)
        if user.role == UserRole.SCRUTINIZER:
            # Main Evaluator / Bundle Custodian sees every bundle.
            return EvaluationBundle.objects.all()
        if user.role == UserRole.FACULTY:
            # Coordinators see bundles for their own subjects (distribution
            # management) plus anything assigned to them personally.
            return EvaluationBundle.objects.filter(
                models.Q(evaluator=user) | models.Q(subject__coordinator=user)
            )
        if user.role in ("CHIEF_SUPERINTENDENT", "HOD"):
            return EvaluationBundle.objects.all()
        return EvaluationBundle.objects.none()

    def _bundle_attempts(self, bundle):
        """Answer booklets belonging to this bundle (see EvaluationBundle.attempts_qs)."""
        return bundle.attempts_qs()

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

    @action(detail=False, methods=['post'])
    def create_from_attempts(self, request):
        """Main Evaluator: file unbundled answer booklets into numbered bundles.

        Body: {"subject_id": uuid, "exam_session_id": uuid, "bundle_size": int}
        """
        if request.user.role == UserRole.STUDENT:
            return Response({"error": "Only staff can create bundles."}, status=status.HTTP_403_FORBIDDEN)

        from scheduling.models import Subject, ExamSession

        subject_id = request.data.get("subject_id") or request.data.get("subject")
        session_id = request.data.get("exam_session_id") or request.data.get("exam_session")
        if not subject_id or not session_id:
            return Response({"error": "subject_id and exam_session_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bundle_size = int(request.data.get("bundle_size") or 0)
        except (TypeError, ValueError):
            bundle_size = 0
        if bundle_size < 1 or bundle_size > 500:
            return Response({"error": "bundle_size must be between 1 and 500."}, status=status.HTTP_400_BAD_REQUEST)

        subject = Subject.objects.filter(pk=subject_id).first()
        exam_session = ExamSession.objects.filter(pk=session_id).first()
        if not subject or not exam_session:
            return Response({"error": "Invalid subject or session."}, status=status.HTTP_404_NOT_FOUND)

        attempts = list(
            SEEAttempt.objects.filter(
                subject=subject,
                exam_session=exam_session,
                is_locked=True,
                evaluation_bundle__isnull=True,
            ).order_by("submitted_at")
        )
        if not attempts:
            return Response(
                {"error": "No unbundled answer booklets for this subject/session."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seq = EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session).count()
        created = []
        for start in range(0, len(attempts), bundle_size):
            seq += 1
            chunk = attempts[start:start + bundle_size]
            bundle = EvaluationBundle.objects.create(
                name=f"Bundle #{seq:03d} - {subject.code}",
                subject=subject,
                exam_session=exam_session,
                status="CREATED",
            )
            SEEAttempt.objects.filter(id__in=[a.id for a in chunk]).update(evaluation_bundle=bundle)
            created.append(bundle)

        return Response({
            "message": f"Created {len(created)} bundle(s) filing {len(attempts)} answer booklet(s).",
            "bundles_created": len(created),
            "booklets_bundled": len(attempts),
            "bundles": EvaluationBundleSerializer(created, many=True).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='redeem', url_name='redeem')
    def redeem_access_code(self, request):
        """Faculty/evaluator enters the secure code issued at assignment.

        The code is bound to (bundle, subject, exam session).
        Allowed: assigned evaluator, course coordinator (faculty), main evaluator.
        """
        code = (request.data.get("code") or "").strip().upper()
        if not code:
            return Response({"error": "Access code is required."}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == UserRole.STUDENT:
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        bundle = (
            EvaluationBundle.objects.filter(access_code=code)
            .select_related("subject", "exam_session", "evaluator")
            .first()
        )
        if bundle is None:
            return Response({"error": "Invalid access code."}, status=status.HTTP_404_NOT_FOUND)

        # Check permissions: evaluator, course coordinator, or main evaluator (CoE)
        user = request.user
        is_evaluator = bundle.evaluator_id == user.id
        is_coordinator = bundle.subject.coordinator_id == user.id
        is_main_evaluator = user.role in [UserRole.SCRUTINIZER, UserRole.CHIEF_SUPERINTENDENT]

        if not (is_evaluator or is_coordinator or is_main_evaluator):
            return Response({"error": "Invalid access code."}, status=status.HTTP_404_NOT_FOUND)

        if bundle.redeemed_at is None:
            bundle.redeemed_at = timezone.now()
            bundle.save(update_fields=["redeemed_at"])

        return Response(EvaluationBundleSerializer(bundle).data)

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Main Evaluator dashboard — real answer-booklet intake + bundle stats.

        Returns stats, per-subject intake rows and an evaluator pick list
        with live bundle counts. No dummy data: everything is computed from
        SEEAttempt / SEEAnswer / EvaluationBundle rows.
        """
        user = request.user
        if user.role == UserRole.STUDENT:
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Count, Q
        from collections import defaultdict
        from scheduling.models import Subject
        from users.models import User

        bundles = self.get_queryset()

        if user.role == UserRole.FACULTY:
            scoped_subjects = Subject.objects.filter(coordinator=user)
            attempts = SEEAttempt.objects.filter(is_locked=True, subject__in=scoped_subjects)
        elif user.role == UserRole.EVALUATOR:
            attempts = SEEAttempt.objects.filter(
                is_locked=True, evaluation_bundle__in=bundles
            )
        else:
            attempts = SEEAttempt.objects.filter(is_locked=True)

        agg = bundles.aggregate(
            total=Count("id"),
            with_evaluator=Count("id", filter=Q(evaluator_id__isnull=False)),
            evaluators=Count("evaluator_id", filter=Q(evaluator_id__isnull=False), distinct=True),
            created=Count("id", filter=Q(status="CREATED")),
            assigned=Count("id", filter=Q(status="ASSIGNED")),
            in_progress=Count("id", filter=Q(status="IN_PROGRESS")),
            completed=Count("id", filter=Q(status="COMPLETED")),
            verified=Count("id", filter=Q(status="VERIFIED")),
            certified=Count("id", filter=Q(status="CERTIFIED")),
            dispatched=Count("id", filter=Q(status="DISPATCHED")),
        )

        stats = {
            "booklets_received": attempts.count(),
            "booklets_unbundled": attempts.filter(evaluation_bundle__isnull=True).count(),
            "bundles_created": agg["total"],
            "bundles_assigned": agg["with_evaluator"],
            "evaluators_active": agg["evaluators"],
            "awaiting_evaluation": agg["created"] + agg["assigned"] + agg["in_progress"],
            "awaiting_verification": agg["completed"],
            "awaiting_certification": agg["verified"],
            "certified": agg["certified"],
            "dispatched": agg["dispatched"],
        }

        # ── Per subject/session intake rows (attempts + bundles union) ──────
        pairs = {}

        def _pair(subject, exam_session):
            key = (subject.id, exam_session.id)
            if key not in pairs:
                pairs[key] = {
                    "subject": subject,
                    "exam_session": exam_session,
                    "received": 0,
                    "unbundled": 0,
                    "bundles": 0,
                    "graded_answers": 0,
                    "total_answers": 0,
                }
            return pairs[key]

        for attempt in attempts.select_related("subject", "exam_session"):
            p = _pair(attempt.subject, attempt.exam_session)
            p["received"] += 1
            if attempt.evaluation_bundle_id is None:
                p["unbundled"] += 1

        answer_rows = (
            SEEAnswer.objects.filter(attempt__in=attempts)
            .values("attempt__subject_id", "attempt__exam_session_id")
            .annotate(
                total=Count("id"),
                graded=Count("id", filter=Q(marks_awarded__isnull=False)),
            )
        )
        for row in answer_rows:
            key = (row["attempt__subject_id"], row["attempt__exam_session_id"])
            if key in pairs:
                pairs[key]["total_answers"] += row["total"]
                pairs[key]["graded_answers"] += row["graded"]

        for bundle in bundles.select_related("subject", "exam_session"):
            p = _pair(bundle.subject, bundle.exam_session)
            p["bundles"] += 1

        subjects_out = sorted(
            (
                {
                    "subject_id": str(p["subject"].id),
                    "subject_code": p["subject"].code,
                    "subject_name": p["subject"].name,
                    "exam_session_id": str(p["exam_session"].id),
                    "exam_session_name": p["exam_session"].name,
                    "received": p["received"],
                    "unbundled": p["unbundled"],
                    "bundles": p["bundles"],
                    "graded_answers": p["graded_answers"],
                    "total_answers": p["total_answers"],
                }
                for p in pairs.values()
            ),
            key=lambda r: (r["subject_code"], r["exam_session_name"]),
        )

        # ── Evaluator pick list with live active-bundle counts ──────────────
        bundle_counts = {
            row["evaluator_id"]: row["n"]
            for row in bundles.exclude(evaluator=None)
            .values("evaluator_id")
            .annotate(n=Count("id"))
        }
        evaluators = [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "active_bundles": bundle_counts.get(u.id, 0),
            }
            for u in User.objects.filter(
                role__in=[UserRole.EVALUATOR, UserRole.FACULTY], is_active=True
            ).order_by("full_name")
        ]

        return Response({"stats": stats, "subjects": subjects_out, "evaluators": evaluators})

    @action(detail=True, methods=['post'])
    def assign_evaluator(self, request, pk=None):
        bundle = self.get_object()
        evaluator_id = request.data.get("evaluator_id")
        from users.models import User
        try:
            evaluator = User.objects.get(id=evaluator_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Evaluator not found"}, status=status.HTTP_404_NOT_FOUND)
        if evaluator.role not in (UserRole.EVALUATOR, UserRole.FACULTY, UserRole.SCRUTINIZER):
            return Response({"error": "User cannot be assigned valuation bundles."}, status=status.HTTP_400_BAD_REQUEST)
        reassigned = bundle.evaluator_id != evaluator.id
        bundle.evaluator = evaluator
        if reassigned:
            # Reassignment invalidates the previous faculty member's code.
            bundle.access_code = None
            bundle.redeemed_at = None
        if bundle.status == "CREATED":
            bundle.status = "ASSIGNED"
        bundle.save()

        # Update all scripts in the bundle
        AnswerScript.objects.filter(evaluation_bundle=bundle).update(assigned_evaluator=evaluator)
        return Response({
            "message": (
                f"Bundle assigned to {evaluator.full_name}. "
                f"Access code: {bundle.access_code}"
            ),
            "access_code": bundle.access_code,
            "bundle": EvaluationBundleSerializer(bundle).data,
        })

    def _can_drive_evaluation(self, user, bundle):
        """start/complete: the assigned evaluator, or Main Evaluator/CoE."""
        if user.role in self._MAIN_EVALUATOR_ROLES:
            return True
        return bundle.evaluator_id is not None and bundle.evaluator_id == user.id

    @action(detail=True, methods=['post'])
    def start_evaluation(self, request, pk=None):
        bundle = self.get_object()
        if not bundle.evaluator_id:
            return Response({"error": "Assign an evaluator before starting evaluation."}, status=status.HTTP_400_BAD_REQUEST)
        if not self._can_drive_evaluation(request.user, bundle):
            return Response({"error": "Only the assigned evaluator can start evaluation."}, status=status.HTTP_403_FORBIDDEN)
        if bundle.status not in ("CREATED", "ASSIGNED", "IN_PROGRESS"):
            return Response({"error": f"Cannot start evaluation from status {bundle.status}."}, status=status.HTTP_400_BAD_REQUEST)
        if bundle.status != "IN_PROGRESS":
            bundle.status = "IN_PROGRESS"
            bundle.save(update_fields=["status"])
        return Response(EvaluationBundleSerializer(bundle).data)

    @action(detail=True, methods=['post'])
    def complete_evaluation(self, request, pk=None):
        """Marks submitted: every answer in the bundle's booklets must be graded.

        - The bundle must be IN_PROGRESS (i.e. the evaluator has started it).
        - No answer may be left without a mark.
        - A booklet that has no answer entries at all is treated as missing
          and blocks completion.
        """
        bundle = self.get_object()
        if not bundle.evaluator_id:
            return Response({"error": "Assign an evaluator before completing evaluation."}, status=status.HTTP_400_BAD_REQUEST)
        if not self._can_drive_evaluation(request.user, bundle):
            return Response({"error": "Only the assigned evaluator can complete evaluation."}, status=status.HTTP_403_FORBIDDEN)
        if bundle.status not in ("ASSIGNED", "IN_PROGRESS"):
            return Response({"error": f"Cannot complete evaluation from status {bundle.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Require the bundle to have been started first.
        if bundle.status == "ASSIGNED":
            return Response(
                {"error": "Bundle must first be started (IN_PROGRESS) before completion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts = self._bundle_attempts(bundle)
        if not attempts.exists():
            return Response({"error": "No answer booklets in this bundle."}, status=status.HTTP_400_BAD_REQUEST)

        # Booklet-level missing-content check
        missing = attempts.filter(answers__isnull=True).count()
        if missing:
            return Response(
                {"error": f"{missing} booklet(s) have no answer entries and cannot be completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ungraded = SEEAnswer.objects.filter(attempt__in=attempts, marks_awarded__isnull=True).count()
        if ungraded:
            return Response(
                {"error": f"{ungraded} answer(s) still ungraded across {attempts.count()} booklets."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bundle.status = "COMPLETED"
        bundle.save(update_fields=["status"])
        return Response(EvaluationBundleSerializer(bundle).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Marks Totaling & Verification sign-off (Main Evaluator / CoE)."""
        bundle = self.get_object()
        if request.user.role in (UserRole.STUDENT, UserRole.EVALUATOR):
            return Response(
                {"error": "Only the Main Evaluator / CoE can verify marks."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if bundle.status not in ("COMPLETED", "VERIFIED"):
            return Response(
                {"error": f"Cannot verify from status {bundle.status}. Evaluation must be completed first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if bundle.status != "VERIFIED":
            bundle.status = "VERIFIED"
            bundle.save(update_fields=["status"])
        return Response(EvaluationBundleSerializer(bundle).data)


class ResultPublishViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    _CERTIFY_ROLES = (UserRole.SCRUTINIZER, "CHIEF_SUPERINTENDENT")

    def _resolve(self, data, source="data"):
        """Resolve subject + exam_session from payload/query params."""
        from scheduling.models import Subject, ExamSession
        if source == "query":
            subject_id = data.get('subject')
            session_id = data.get('exam_session')
        else:
            subject_id = data.get("subject_id")
            session_id = data.get("exam_session_id")
        if not subject_id or not session_id:
            return None, None, Response({"error": "subject_id and exam_session_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        subject = Subject.objects.filter(pk=subject_id).first()
        exam_session = ExamSession.objects.filter(pk=session_id).first()
        if not subject or not exam_session:
            return None, None, Response({"error": "Invalid subject or session"}, status=status.HTTP_404_NOT_FOUND)
        return subject, exam_session, None

    def _authorize_subject(self, user, subject):
        """Read guard for the CoE ledger (mirrors SEE valuation rules)."""
        if user.role == UserRole.STUDENT:
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        if user.role == UserRole.EVALUATOR:
            from .models import EvaluationBundle
            if not EvaluationBundle.objects.filter(evaluator=user, subject=subject).exists():
                return Response({"error": "Not assigned to this course."}, status=status.HTTP_403_FORBIDDEN)
        if user.role == UserRole.FACULTY:
            from .models import EvaluationBundle
            if subject.coordinator_id != user.id and not EvaluationBundle.objects.filter(
                evaluator=user, subject=subject
            ).exists():
                return Response({"error": "Not assigned to this course."}, status=status.HTTP_403_FORBIDDEN)
        if user.role == UserRole.HOD:
            dept = getattr(user, "department", None)
            if dept and subject.department_id != dept.id:
                return Response({"error": "Not authorised for this department."}, status=status.HTTP_403_FORBIDDEN)
        return None

    @action(detail=False, methods=['get'])
    def ledger(self, request):
        """CoE Grade Ledger — bundle pipeline + results for a subject/session.

        Results are only returned once every bundle of the subject/session
        has been certified (or dispatched). Before that the response marks
        `results_locked: true` — nothing fabricated, nothing leaked early.
        """
        subject, exam_session, err = self._resolve(request.query_params, source="query")
        if err is not None:
            return err
        err = self._authorize_subject(request.user, subject)
        if err is not None:
            return err

        from .models import EvaluationBundle

        bundles = list(
            EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
            .select_related("evaluator")
            .order_by("created_at")
        )
        status_counts = {}
        for b in bundles:
            status_counts[b.status] = status_counts.get(b.status, 0) + 1

        certified = bool(bundles) and all(b.status in ("CERTIFIED", "DISPATCHED") for b in bundles)
        dispatched = bool(bundles) and all(b.status == "DISPATCHED" for b in bundles)

        results = []
        if certified:
            # Certified booklets become ledger rows — materialize any graded
            # attempt data that hasn't been written to Result yet.
            self._materialize(subject, exam_session)
            results = [
                {
                    "usn": r.student.usn,
                    "student_name": r.student.user.full_name,
                    "cie_marks": float(r.cie_marks) if r.cie_marks is not None else None,
                    "see_marks": float(r.see_marks) if r.see_marks is not None else None,
                    "see_converted_marks": float(r.see_converted_marks) if r.see_converted_marks is not None else None,
                    "total_marks": float(r.total_marks) if r.total_marks is not None else None,
                    "grade": r.grade,
                    "is_published": r.is_published,
                }
                for r in Result.objects.filter(subject=subject, exam_session=exam_session)
                .select_related("student__user")
                .order_by("student__usn")
            ]

        # SEE Evaluation Completed flag: all bundles in the subject/session
        # have reached a terminal status (COMPLETED or beyond).
        all_bundles_terminal = all(
            b.status in ("COMPLETED", "VERIFIED", "CERTIFIED", "DISPATCHED")
            for b in EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
        )
        certified = bool(bundles) and all(b.status in ("CERTIFIED", "DISPATCHED") for b in bundles)
        dispatched = bool(bundles) and all(b.status == "DISPATCHED" for b in bundles)

        return Response({
            "subject": {"id": str(subject.id), "code": subject.code, "name": subject.name},
            "exam_session": {"id": str(exam_session.id), "name": exam_session.name},
            "bundles": [
                {
                    "id": str(b.id),
                    "name": b.name,
                    "status": b.status,
                    "evaluator_name": b.evaluator.full_name if b.evaluator else None,
                }
                for b in bundles
            ],
            "status_counts": status_counts,
            "certified": certified,
            "dispatched": dispatched,
            "results_locked": not certified,
            "evaluation_completed": all_bundles_terminal,
            "results": results,
        })

    @action(detail=False, methods=['post'])
    def certify(self, request):
        """Certification: every bundle for the subject/session must be VERIFIED."""
        if request.user.role not in self._CERTIFY_ROLES:
            return Response({"error": "Only the CoE / Main Evaluator can certify results."}, status=status.HTTP_403_FORBIDDEN)
        subject, exam_session, err = self._resolve(request.data)
        if err is not None:
            return err

        from .models import EvaluationBundle

        bundles = list(
            EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
        )
        if not bundles:
            return Response({"error": "No bundles exist for this subject/session — nothing to certify."}, status=status.HTTP_400_BAD_REQUEST)
        unverified = [b for b in bundles if b.status not in ("VERIFIED", "CERTIFIED", "DISPATCHED")]
        if unverified:
            return Response(
                {"error": f"All bundles must be verified first. {unverified[0].name} is {unverified[0].status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        newly = [b for b in bundles if b.status == "VERIFIED"]
        for b in newly:
            b.status = "CERTIFIED"
            b.save(update_fields=["status"])
        return Response({
            "message": f"Certified {len(newly)} bundle(s).",
            "certified": len(newly),
        })

    @action(detail=False, methods=['post'], url_path='dispatch', url_name='dispatch')
    def dispatch_results(self, request):
        """Dispatch/finalize: certification required; materializes results
        into the CoE grade ledger and notifies students."""
        if request.user.role not in self._CERTIFY_ROLES:
            return Response({"error": "Only the CoE / Main Evaluator can dispatch results."}, status=status.HTTP_403_FORBIDDEN)
        subject, exam_session, err = self._resolve(request.data)
        if err is not None:
            return err

        from .models import EvaluationBundle

        bundles = list(
            EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
        )
        if not bundles:
            return Response({"error": "No bundles exist for this subject/session — nothing to dispatch."}, status=status.HTTP_400_BAD_REQUEST)
        uncertified = [b for b in bundles if b.status not in ("CERTIFIED", "DISPATCHED")]
        if uncertified:
            return Response(
                {"error": f"All bundles must be certified first. {uncertified[0].name} is {uncertified[0].status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        newly = [b for b in bundles if b.status == "CERTIFIED"]
        for b in newly:
            b.status = "DISPATCHED"
            b.save(update_fields=["status"])

        # Materialise results into Result rows.
        results_created, results_updated = self._materialize(subject, exam_session)

        # Flip is_published and announced_at for all Result rows of this
        # subject/session that are not yet published.
        published_ids = set()
        for r in Result.objects.filter(subject=subject, exam_session=exam_session):
            if not r.is_published:
                r.is_published = True
                r.announced_at = timezone.now()
                r.save(update_fields=["is_published", "announced_at"])
                published_ids.add(r.id)

        # Notify only students whose results were just published.
        if published_ids:
            from notifications.helpers import notify_students_bulk

            newly_published = Result.objects.filter(id__in=published_ids).select_related("student")
            notify_students_bulk(
                [s.student for s in newly_published],
                "RESULT_PUBLISHED",
                f"Result Published – {subject.code}",
                f"Your result for {subject.code} ({exam_session.name}) has been published. Check the Results section.",
                related_object_id=exam_session.id,
            )

        return Response({
            "message": "Dispatched to CoE grade ledger.",
            "bundles_dispatched": len(newly),
            "results_created": results_created,
            "results_updated": results_updated,
        })

    @action(detail=False, methods=['post'])
    def publish_results(self, request):
        user = request.user
        if user.role not in ["COE", "CHIEF_SUPERINTENDENT"]:
            return Response({"error": "Only CoE can publish results"}, status=status.HTTP_403_FORBIDDEN)

        subject, exam_session, err = self._resolve(request.data)
        if err is not None:
            return err

        # ── Verification gate ──────────────────────────────────────────
        from .models import EvaluationBundle

        bundles = list(
            EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
        )
        if bundles:
            unverified = [b for b in bundles if b.status not in ("VERIFIED", "CERTIFIED", "DISPATCHED")]
            if unverified:
                first = unverified[0]
                return Response(
                    {"error": f"All bundles must be verified first. {first.name} is {first.status}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Materialise results into Result rows.
        results_created, results_updated = self._materialize(subject, exam_session)

        # Flip is_published and announced_at for all Result rows of this
        # subject/session that are not yet published.
        published_ids = set()
        for r in Result.objects.filter(subject=subject, exam_session=exam_session):
            if not r.is_published:
                r.is_published = True
                r.announced_at = timezone.now()
                r.save(update_fields=["is_published", "announced_at"])
                published_ids.add(r.id)

        # Notify only students whose results were just published.
        if published_ids:
            from notifications.helpers import notify_students_bulk

            newly_published = Result.objects.filter(id__in=published_ids).select_related("student")
            notify_students_bulk(
                [s.student for s in newly_published],
                "RESULT_PUBLISHED",
                f"Result Published – {subject.code}",
                f"Your result for {subject.code} ({exam_session.name}) has been published. Check the Results section.",
                related_object_id=exam_session.id,
            )

        return Response({
            "message": "Results published successfully",
            "results_created": results_created,
            "results_updated": results_updated,
            "is_published": True,
        })

    def _materialize(self, subject, exam_session):
        """Materialize graded attempt/script data into Result rows.

        Returns (results_created, results_updated). Used by both the
        explicit publish_results action and the certified dispatch flow.
        """
        from django.db.models import Sum
        from .models import AnswerScript, AnswerScriptKeyMap
        from eligibility.models import StudentEligibility

        def _latest_cie(student):
            eligibility = (
                StudentEligibility.objects.filter(
                    student=student,
                    subject=subject,
                    cie_marks__isnull=False,
                )
                .order_by('-updated_at', '-created_at')
                .first()
            )
            # None (unknown) instead of fabricating 0.00 when no CIE data exists
            return eligibility.cie_marks if eligibility else None

        results_created = 0
        results_updated = 0

        # ── Path 1 (legacy anonymized scripts) ───────────────────────────────
        completed_scripts = AnswerScript.objects.filter(
            question_paper__exam_session=exam_session,
            question_paper__subject=subject,
            status="COMPLETED"
        )

        for script in completed_scripts:
            try:
                keymap = AnswerScriptKeyMap.objects.get(answer_script=script)
                student = keymap.student
                cie_marks = _latest_cie(student)

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

        # ── Path 2 (live digital SEE attempts — graded answers → Result) ─────
        see_attempts = SEEAttempt.objects.filter(
            subject=subject, exam_session=exam_session, is_locked=True
        ).select_related('student')

        for attempt in see_attempts:
            total = (
                SEEAnswer.objects.filter(attempt=attempt, marks_awarded__isnull=False)
                .aggregate(total=Sum('marks_awarded'))['total']
            )
            if total is None:
                # Ungraded attempts are not part of this publication.
                continue

            cie_marks = _latest_cie(attempt.student)
            result, created = Result.objects.get_or_create(
                student=attempt.student,
                subject=subject,
                exam_session=exam_session,
                defaults={'cie_marks': cie_marks}
            )
            result.cie_marks = cie_marks
            result.see_marks = total
            result.save()

            if created:
                results_created += 1
            else:
                results_updated += 1

        return results_created, results_updated

    def _notify_results_published(self, exam_session, subject, results_created):
        """Send notifications to students whose results were published."""
        from notifications.helpers import notify_students_bulk
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
