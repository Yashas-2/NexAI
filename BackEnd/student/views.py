import hashlib

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.models import Student
from users.constants import UserRole
from eligibility.models import HallTicket, StudentEligibility
from eligibility.serializers import HallTicketSerializer
from evaluation.models import AnswerScriptKeyMap
from vault.models import QuestionPaper
from cie.ocr_service import extract_text_from_base64
from .models import Result, SEEAttempt, SEEAnswer
from .serializers import ResultSerializer

# Grade point scale used for CGPA/SGPA (mirrors analytics.views.GRADE_POINTS)
GRADE_POINTS = {'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'F': 0, 'ABSENT': 0}


def _compute_gpa(results):
    """Credit-weighted GPA over the given (select_related subject) results."""
    numerator = 0.0
    credits_total = 0
    for r in results:
        if not r.grade:
            continue
        credits = r.subject.credits or 0
        points = GRADE_POINTS.get(r.grade, 0)
        numerator += points * credits
        credits_total += credits
    if credits_total == 0:
        return None
    return round(numerator / credits_total, 2)


class StudentPortalViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_student(self, user):
        try:
            return Student.objects.get(user=user)
        except Student.DoesNotExist:
            return None

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        results = list(
            Result.objects.filter(student=student)
            .select_related('subject', 'exam_session')
            .order_by('-exam_session__start_date')
        )
        cgpa = _compute_gpa(results)

        # SGPA of the most recent session that has graded results
        latest_sgpa = None
        seen_sessions = set()
        for r in results:
            if r.exam_session_id in seen_sessions or not r.grade:
                continue
            seen_sessions.add(r.exam_session_id)
            if latest_sgpa is None:
                session_results = [x for x in results if x.exam_session_id == r.exam_session_id]
                latest_sgpa = _compute_gpa(session_results)

        return Response({
            "usn": student.usn,
            "name": student.user.full_name,
            "email": student.user.email,
            "department": student.department.name,
            "semester": student.current_semester,
            "section": getattr(student, 'section', None),
            "batch_year": student.batch_year,
            "cgpa": cgpa,
            "latest_sgpa": latest_sgpa,
        })

    @action(detail=False, methods=['get'])
    def my_hall_tickets(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        hall_tickets = HallTicket.objects.filter(student=student).order_by('-created_at')
        serializer = HallTicketSerializer(hall_tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_results(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Sync AnswerScript SEE marks into Result records for this student.
        key_maps = AnswerScriptKeyMap.objects.filter(student=student).select_related('answer_script')
        
        for key_map in key_maps:
            script = key_map.answer_script
            if script.status == 'COMPLETED':
                # The AnswerScript belongs to a ScanningSession -> TimetableSlot -> Subject
                timetable_slot = script.scanning_session.timetable_slot

                result, created = Result.objects.get_or_create(
                    student=student,
                    subject=timetable_slot.subject,
                    exam_session=timetable_slot.exam_session,
                    defaults={}
                )

                # Update SEE marks
                if result.see_marks != script.evaluator_total_score:
                    result.see_marks = script.evaluator_total_score
                    result.save() # This triggers the grade calculation

        # Sync graded SEE digital attempts (the live path — answers graded via
        # /student/see/grade_answer/). Mirrors the AnswerScript sync above.
        graded_see = (
            SEEAnswer.objects.filter(
                attempt__student=student,
                attempt__is_locked=True,
                marks_awarded__isnull=False,
            )
            .values('attempt__subject_id', 'attempt__exam_session_id')
            .annotate(total=Sum('marks_awarded'))
        )
        for row in graded_see:
            result, _created = Result.objects.get_or_create(
                student=student,
                subject_id=row['attempt__subject_id'],
                exam_session_id=row['attempt__exam_session_id'],
                defaults={}
            )
            if result.see_marks != row['total']:
                result.see_marks = row['total']
                result.save() # This triggers the grade calculation

        # Backfill real CIE marks from the student's latest eligibility record
        # (source of truth for CIE). Only fills results where CIE is still unknown.
        latest_cie = {}
        for elig in (
            StudentEligibility.objects.filter(student=student, cie_marks__isnull=False)
            .order_by('-updated_at', '-created_at')
            .values_list('subject_id', 'cie_marks')
        ):
            subject_id, cie = elig
            if subject_id not in latest_cie:
                latest_cie[subject_id] = cie

        for result in Result.objects.filter(student=student, cie_marks__isnull=True):
            cie = latest_cie.get(result.subject_id)
            if cie is not None:
                result.cie_marks = cie
                result.save() # recalculates total_marks + grade

        # Now return all results with publish gating
        results = Result.objects.filter(student=student).select_related(
            'subject', 'exam_session'
        ).order_by('-exam_session__start_date', 'subject__code')
        serializer = ResultSerializer(results, many=True)
        rows = serializer.data
        for row, r in zip(rows, results):
            row["is_published"] = r.is_published
            if not r.is_published:
                row["announcement"] = "Result Not Yet Announced"
                for k in ("cie_marks", "see_marks", "see_converted_marks", "total_marks", "grade"):
                    row[k] = None
        return Response(rows)

    @action(detail=False, methods=['get'])
    def my_enrollments(self, request):
        from scheduling.models import StudentSubjectEnrollment
        from scheduling.serializers import StudentSubjectEnrollmentSerializer
        
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        enrollments = StudentSubjectEnrollment.objects.filter(student=student).select_related(
            "subject", "exam_session"
        ).order_by('-enrolled_at')
        
        # Deduplicate
        seen_subjects = set()
        unique_enrollments = []
        for enrollment in enrollments:
            if enrollment.subject_id not in seen_subjects:
                unique_enrollments.append(enrollment)
                seen_subjects.add(enrollment.subject_id)
        
        serializer = StudentSubjectEnrollmentSerializer(unique_enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_cie_schedule(self, request):
        """Returns CIE schedule info for the student including hall/seat allocation."""
        from scheduling.models import ExamSession
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        from scheduling.models import TimetableSlot

        # Get CIE sessions the student is enrolled in
        cie_sessions = ExamSession.objects.filter(
            session_type='CIE',
            student_enrollments__student=student,
        ).distinct()

        schedule = []
        seen_slots = set()
        for session in cie_sessions:
            # Only active slots — rescheduled/cancelled slots are audit history
            slots = TimetableSlot.objects.filter(
                exam_session=session,
                seat_map__has_key=student.usn,
                status__in=['SCHEDULED', 'CONFIRMED'],
            ).select_related('subject', 'room')

            for slot in slots:
                if slot.id in seen_slots:
                    continue
                seen_slots.add(slot.id)
                seat = (slot.seat_map or {}).get(student.usn)
                schedule.append({
                    'session_name': session.name,
                    'slot_id': str(slot.id),
                    'subject_code': slot.subject.code,
                    'subject_name': slot.subject.name,
                    'date': slot.exam_date.isoformat() if slot.exam_date else None,
                    'start_time': slot.start_time.isoformat() if slot.start_time else None,
                    'end_time': slot.end_time.isoformat() if slot.end_time else None,
                    'room': slot.room.name if slot.room else None,
                    'seat': seat,
                    'status': slot.status,
                })
        return Response(schedule)

    @action(detail=False, methods=['get'])
    def my_attendance(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        slot_id = request.query_params.get('slot_id')
        if not slot_id:
            return Response({"error": "slot_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from scheduling.models import StudentExamAttendance
        attendance = StudentExamAttendance.objects.filter(timetable_slot_id=slot_id, student=student).first()
        if attendance:
            return Response({
                "is_present": attendance.status.lower() == 'present',
                "is_qr_verified": attendance.is_qr_verified
            })
        return Response({
            "is_present": False,
            "is_qr_verified": False
        })

    @action(detail=False, methods=['get'])
    def exam_attempt_status(self, request):
        """
        Check if a student has completed an exam attempt for a given slot/subject.
        Query params: slot_id (timetable slot ID) OR subject_code + exam_session_id
        """
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        slot_id = request.query_params.get('slot_id')
        subject_code = request.query_params.get('subject_code')
        exam_session_id = request.query_params.get('exam_session_id')

        if not slot_id and not (subject_code and exam_session_id):
            return Response({"error": "slot_id or (subject_code + exam_session_id) required"}, status=status.HTTP_400_BAD_REQUEST)

        if slot_id:
            from scheduling.models import TimetableSlot, StudentSubjectEnrollment
            slot = TimetableSlot.objects.filter(pk=slot_id).select_related('subject', 'exam_session').first()
            if not slot:
                return Response({"error": "Invalid slot_id"}, status=status.HTTP_404_NOT_FOUND)
            
            subject = slot.subject
            exam_session = slot.exam_session
        else:
            from scheduling.models import Subject, ExamSession
            subject = Subject.objects.filter(code=subject_code).first()
            exam_session = ExamSession.objects.filter(pk=exam_session_id).first()
            if not subject or not exam_session:
                return Response({"error": "Invalid subject_code or exam_session_id"}, status=status.HTTP_404_NOT_FOUND)

        # Check if student is enrolled in this subject/session
        from scheduling.models import StudentSubjectEnrollment
        enrollment = StudentSubjectEnrollment.objects.filter(
            student=student, subject=subject, exam_session=exam_session
        ).first()
        if not enrollment:
            return Response({
                "eligible": False,
                "message": "Not enrolled in this exam"
            }, status=status.HTTP_403_FORBIDDEN)

        # Check SEE attempt status
        attempt = SEEAttempt.objects.filter(
            student=student, subject=subject, exam_session=exam_session
        ).first()

        if attempt:
            is_completed = attempt.is_locked or attempt.submitted_at is not None
            return Response({
                "eligible": True,
                "attempt_id": str(attempt.id),
                "is_completed": is_completed,
                "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "is_locked": attempt.is_locked,
                "proctor_strikes": attempt.proctor_strikes,
            })
        else:
            # Check if exam session has ended (no attempt possible after end time)
            from django.utils import timezone
            exam_ended = exam_session.end_date is not None and timezone.now() > exam_session.end_date
            
            return Response({
                "eligible": True,
                "attempt_id": None,
                "is_completed": False,
                "exam_ended": exam_ended,
                "message": "Exam not started yet" if not exam_ended else "Exam time has ended"
            })

    def _see_exam_context(self, student, subject_code):
        """Resolve subject/session/attempt/paper/questions for a SEE kiosk call.

        Returns ``(context_tuple, None)`` on success or ``(None, Response)``
        carrying the appropriate error response.
        """
        from scheduling.models import ExamSession, Subject
        subject = Subject.objects.filter(code=subject_code).first()
        if not subject:
            return None, Response({"error": "Subject not found."}, status=status.HTTP_404_NOT_FOUND)

        # The SEE session this student is enrolled in for this subject
        exam_session = (
            ExamSession.objects.filter(
                session_type='SEE',
                student_enrollments__student=student,
                student_enrollments__subject=subject,
            )
            .order_by('-start_date')
            .first()
        )
        if not exam_session:
            exam_session = ExamSession.objects.filter(session_type='SEE').order_by('-start_date').first()
        if not exam_session:
            return None, Response({"error": "No SEE session found."}, status=status.HTTP_404_NOT_FOUND)

        attempt, _created = SEEAttempt.objects.get_or_create(
            student=student, subject=subject, exam_session=exam_session
        )
        paper = (
            QuestionPaper.objects.filter(subject=subject, exam_session=exam_session)
            .order_by('-created_at')
            .first()
        )
        questions = list(paper.questions.all()) if paper else []
        return (subject, exam_session, attempt, paper, questions), None

    @action(detail=False, methods=['post'])
    def see_save_answer(self, request):
        """
        POST /student/portal/see_save_answer/
        Auto-save draft answers while the exam is running. Never locks the
        attempt and never re-runs OCR — the final see_submit does that.
        Answers are keyed by question + sub-question part so every sub-answer
        is stored against the correct question.
        Body: {subject_code, answers: [{question_number, part, question_text,
               answer_text, answer_image_base64}]}
        """
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        subject_code = request.data.get('subject_code')
        if not subject_code:
            return Response({"error": "subject_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        ctx, err = self._see_exam_context(student, subject_code)
        if err is not None:
            return err
        subject, exam_session, attempt, paper, questions = ctx

        if attempt.is_locked:
            return Response({"error": "Exam Already Submitted."}, status=status.HTTP_400_BAD_REQUEST)

        answers_data = request.data.get('answers', [])
        saved = 0
        for ans in answers_data:
            question = _resolve_question(questions, ans)
            if question is None:
                continue
            defaults = {"answer_text": ans.get('answer_text', '')}
            image = (ans.get('answer_image_base64') or '').strip()
            if image:
                # Only overwrite the stored script image when one is provided.
                defaults["answer_image_base64"] = image
            SEEAnswer.objects.update_or_create(
                attempt=attempt,
                question=question,
                defaults=defaults,
            )
            saved += 1

        return Response({"status": "saved", "saved": saved})

    @action(detail=False, methods=['post'])
    def see_submit(self, request):
        """
        POST /student/portal/see_submit/
        Submit a SEE attempt from the exam kiosk (mirrors /cie/test/kiosk_submit/).
        Body: {subject_code, answers: [{question_number, part, question_text,
               answer_text, answer_image_base64}], strike_count}
        """
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        subject_code = request.data.get('subject_code')
        if not subject_code:
            return Response({"error": "subject_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        ctx, err = self._see_exam_context(student, subject_code)
        if err is not None:
            return err
        subject, exam_session, attempt, paper, questions = ctx

        if attempt.is_locked:
            return Response({"error": "Exam Already Submitted."}, status=status.HTTP_400_BAD_REQUEST)

        answers_data = request.data.get('answers', [])

        has_content = False
        stored = 0
        for ans in answers_data:
            text = (ans.get('answer_text') or '').strip()
            image = (ans.get('answer_image_base64') or '').strip()
            if text or image:
                has_content = True

            question = _resolve_question(questions, ans)
            if question is None:
                continue

            SEEAnswer.objects.update_or_create(
                attempt=attempt,
                question=question,
                defaults={
                    "answer_text": ans.get('answer_text', ''),
                    "answer_image_base64": ans.get('answer_image_base64', ''),
                    "extracted_text": (
                        extract_text_from_base64(ans.get('answer_image_base64', ''))
                        if ans.get('answer_image_base64') else ''
                    ),
                },
            )
            stored += 1

        if answers_data and stored == 0 and has_content:
            return Response(
                {"error": "No questions matched the submitted answers. Check the question paper."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        attempt.is_locked = True
        attempt.submitted_at = timezone.now()
        try:
            attempt.proctor_strikes = max(0, min(3, int(request.data.get('strike_count') or 0)))
        except (TypeError, ValueError):
            attempt.proctor_strikes = 0
        attempt.save()

        receipt_hash = hashlib.sha256(f"{attempt.id}-{attempt.submitted_at}".encode()).hexdigest()[:24]

        return Response({
            "status": "Exam submitted successfully",
            "attempt_id": str(attempt.id),
            "receipt_hash": "0x" + receipt_hash,
            "submission_status": "SUBMITTED" if has_content else "NOT_ATTENDED",
            "proctor_strikes": attempt.proctor_strikes,
            "integrity_score": round((3 - attempt.proctor_strikes) / 3 * 100),
            "answers_stored": stored,
        })


def _norm_part(value):
    """Normalise a sub-question part marker: '(a)' / 'a' → 'a'."""
    return str(value or "").strip().strip("()").lower()


def _resolve_question(questions, ans):
    """Match a submitted answer to its vault.Question by number+part, then text.

    Sub-questions (Q1(a), Q1(b), …) share a question_number, so an answer
    carrying a part must bind to the row with that exact part — never to a
    sibling sub-question.
    """
    qnum = ans.get('question_number')
    qtext = (ans.get('question_text') or '').strip()
    part = _norm_part(ans.get('part'))

    pool = questions
    if qnum is not None and str(qnum) != '':
        pool = [q for q in questions if str(q.question_number) == str(qnum)]

    if part:
        part_pool = [q for q in pool if _norm_part(q.part) == part]
        if part_pool:
            pool = part_pool
        else:
            # This part doesn't exist in the paper — only an exact text match
            # may bind the answer, otherwise drop it rather than store it
            # against the wrong sub-question.
            if qtext:
                return next(
                    (q for q in questions if (q.text_content or '').strip() == qtext),
                    None,
                )
            return None

    if qtext:
        exact = next((q for q in pool if (q.text_content or '').strip() == qtext), None)
        if exact:
            return exact

    if pool:
        # Without a part marker keep the legacy behaviour (first number match).
        return pool[0]

    if qtext:
        return next((q for q in questions if (q.text_content or '').strip() == qtext), None)
    return None


class SEETestViewSet(viewsets.ViewSet):
    """Faculty/evaluator SEE valuation endpoints.

    Mirrors the CIE pair /cie/test/submissions/ + /cie/test/grade_answer/:
    every submitted SEE attempt (handwriting images + OCR text) is listed
    per subject and graded answer-by-answer, with the attempt total synced
    into Result.see_marks.
    """
    permission_classes = [IsAuthenticated]

    def _authorize_valuation(self, user, subject, exam_session=None):
        """Role guard mirroring cie.list_submissions/grade_answer.

        Returns None when allowed, otherwise the error Response.
        """
        if user.role == UserRole.STUDENT:
            return Response({"error": "Access denied."}, status=403)
        if user.role in (UserRole.FACULTY, UserRole.EVALUATOR):
            from evaluation.models import EvaluationBundle
            allowed = user.role == UserRole.FACULTY and subject.coordinator_id == user.id
            if not allowed:
                bundles = EvaluationBundle.objects.filter(evaluator=user, subject=subject)
                if exam_session is not None:
                    bundles = bundles.filter(exam_session=exam_session)
                allowed = bundles.exists()
            if not allowed:
                return Response({"error": "Not assigned to this course."}, status=403)
        elif user.role == UserRole.HOD:
            dept = getattr(user, 'department', None)
            if dept and subject.department_id != dept.id:
                return Response({"error": "Not authorised for this department."}, status=403)
        return None

    @action(detail=False, methods=['get'])
    def submissions(self, request):
        """
        GET /student/see/submissions/?subject=<uuid>[&exam_session=<uuid>]
        Retrieve every submitted SEE attempt (with answers) for a subject.
        When exam_session is omitted the latest SEE session enrolled for
        that subject is used.
        """
        from scheduling.models import ExamSession, Subject

        subject_id = request.query_params.get('subject')
        if not subject_id:
            return Response({"error": "subject query param is required."}, status=400)

        subject = Subject.objects.filter(pk=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found."}, status=404)

        exam_session = None
        session_id = request.query_params.get('exam_session')
        if session_id:
            exam_session = ExamSession.objects.filter(pk=session_id).first()
            if not exam_session:
                return Response({"error": "Exam session not found."}, status=404)
        else:
            exam_session = (
                ExamSession.objects.filter(
                    session_type='SEE', student_enrollments__subject=subject
                )
                .distinct()
                .order_by('-start_date')
                .first()
            )
            if not exam_session:
                return Response({"error": "No SEE session found for this subject."}, status=404)

        err = self._authorize_valuation(request.user, subject, exam_session)
        if err is not None:
            return err

        attempts = (
            SEEAttempt.objects.filter(
                subject=subject, exam_session=exam_session, is_locked=True
            )
            .select_related('student__user')
            .prefetch_related('answers__question')
            .order_by('submitted_at')
        )

        # Bundles for this subject+session (Main Evaluator files booklets
        # under numbered bundles; legacy flows have one subject-level bundle).
        from django.db.models import Count
        from evaluation.models import EvaluationBundle
        bundles_qs = (
            EvaluationBundle.objects.filter(subject=subject, exam_session=exam_session)
            .select_related('evaluator')
            .annotate(booklets=Count('see_attempts'))
            .order_by('created_at')
        )
        bundles_data = [
            {
                "id": str(b.id),
                "name": b.name,
                "status": b.status,
                "evaluator_id": str(b.evaluator_id) if b.evaluator_id else None,
                "evaluator_name": b.evaluator.full_name if b.evaluator else None,
                "booklets": b.booklets,
            }
            for b in bundles_qs
        ]
        # Legacy single-bundle reference (latest) kept for existing panels.
        bundle_data = bundles_data[-1] if bundles_data else None

        data = []
        for attempt in attempts:
            answers = []
            graded_count = 0
            graded_total = 0.0
            for ans in attempt.answers.all():
                q = ans.question
                label = f"Q{q.question_number}({q.part})" if q.part else f"Q{q.question_number}"
                if ans.marks_awarded is not None:
                    graded_count += 1
                    graded_total += float(ans.marks_awarded)
                answers.append({
                    "answer_id": str(ans.id),
                    "question_id": str(q.id),
                    "question_label": label,
                    "question_text": q.text_content,
                    "max_marks": q.marks,
                    "answer_text": ans.answer_text,
                    "answer_image_base64": ans.answer_image_base64,
                    "extracted_text": ans.extracted_text,
                    "marks_awarded": ans.marks_awarded,
                })
            data.append({
                "attempt_id": str(attempt.id),
                "student_usn": attempt.student.usn,
                "student_name": attempt.student.user.full_name,
                "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "proctor_strikes": attempt.proctor_strikes,
                "bundle_id": str(attempt.evaluation_bundle_id) if attempt.evaluation_bundle_id else None,
                "answers": answers,
                "answers_count": len(answers),
                "graded_count": graded_count,
                "graded_total": graded_total,
                "fully_graded": bool(answers) and graded_count == len(answers),
            })

        return Response({
            "count": len(data),
            "subject": {"id": str(subject.id), "code": subject.code, "name": subject.name},
            "exam_session": {"id": str(exam_session.id), "name": exam_session.name},
            "bundle": bundle_data,
            "bundles": bundles_data,
            "submissions": data,
        })

    @action(detail=False, methods=['post'])
    def grade_answer(self, request):
        """
        POST /student/see/grade_answer/
        Award marks to a single SEE answer; the attempt total is auto-synced
        into Result.see_marks (mirrors /cie/test/grade_answer/ → CIEMarks).

        Body: {"answer_id": "<uuid>", "marks_awarded": 12.5}
        """
        answer_id = request.data.get('answer_id')
        marks_awarded = request.data.get('marks_awarded')
        if answer_id is None or marks_awarded is None:
            return Response({"error": "answer_id and marks_awarded are required."}, status=400)

        answer = SEEAnswer.objects.select_related(
            'attempt__student', 'attempt__subject', 'attempt__exam_session', 'question'
        ).filter(pk=answer_id).first()
        if not answer:
            return Response({"error": "Answer not found."}, status=404)

        attempt = answer.attempt
        err = self._authorize_valuation(request.user, attempt.subject, attempt.exam_session)
        if err is not None:
            return err

        try:
            marks_awarded = float(marks_awarded)
        except (ValueError, TypeError):
            return Response({"error": "marks_awarded must be a number."}, status=400)
        if marks_awarded < 0:
            return Response({"error": "marks_awarded cannot be negative."}, status=400)

        answer.marks_awarded = marks_awarded
        answer.save(update_fields=['marks_awarded'])

        total = (
            SEEAnswer.objects.filter(attempt=attempt, marks_awarded__isnull=False)
            .aggregate(total=Sum('marks_awarded'))['total'] or 0
        )

        # Auto-sync the attempt total into Result (mirrors CIE → CIEMarks sync)
        result, _created = Result.objects.get_or_create(
            student=attempt.student,
            subject=attempt.subject,
            exam_session=attempt.exam_session,
            defaults={}
        )
        if result.see_marks != total:
            result.see_marks = total
            result.save() # This triggers the grade calculation

        return Response({
            "status": "grade saved",
            "attempt_id": str(attempt.id),
            "see_marks_total": float(total),
        })

    @action(detail=False, methods=['get'])
    def evaluators(self, request):
        """GET /student/see/evaluators/ — pick list for distributing SEE valuation."""
        if request.user.role == UserRole.STUDENT:
            return Response({"error": "Access denied."}, status=403)
        from users.models import User
        from users.serializers import UserSerializer
        evaluators = User.objects.filter(
            role__in=[UserRole.EVALUATOR, UserRole.FACULTY], is_active=True
        ).order_by('full_name')
        return Response(UserSerializer(evaluators, many=True).data)
