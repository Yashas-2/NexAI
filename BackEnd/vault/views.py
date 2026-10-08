import json
from datetime import datetime, timedelta

from django.http import Http404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from core.permissions import IsPaperSetter, IsChiefSuperintendent
from .models import QuestionPaper, Question
from .serializers import QuestionPaperSerializer, PaperLockSerializer
from .crypto import generate_aes_key, hash_key, encrypt_aes_key, encrypt_payload, decrypt_aes_key, decrypt_payload
from .ipfs_service import upload_to_ipfs, fetch_from_ipfs


# ---- question-paper release helpers ---------------------------------------

_RELEASEABLE_STATUSES = (
    QuestionPaper.PaperStatus.DRAFT,
    QuestionPaper.PaperStatus.SUBMITTED,
    QuestionPaper.PaperStatus.APPROVED,
    QuestionPaper.PaperStatus.ENCRYPTED,
    QuestionPaper.PaperStatus.DISTRIBUTED,
)
_SLOT_STATUSES = ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED')
_PAPER_EARLY_WINDOW = timedelta(minutes=2)
_PAPER_ACCESS_WINDOW = timedelta(hours=48)


def _lookup_release_target(pk):
    """Resolve the release target by pk, bypassing the role-scoped queryset.

    QuestionPaperViewSet.get_queryset() returns nothing for students, so
    get_object() would 404 them; look the row up directly instead.
    """
    from django.core.exceptions import ValidationError
    from cie.models import CIEQuestionPaperScrutiny

    try:
        paper = QuestionPaper.objects.filter(pk=pk).first()
    except (ValueError, ValidationError, TypeError):
        paper = None
    if paper is not None:
        return paper, False
    try:
        scrutiny = CIEQuestionPaperScrutiny.objects.filter(pk=pk).first()
    except (ValueError, ValidationError, TypeError):
        scrutiny = None
    if scrutiny is not None:
        return scrutiny, True
    raise Http404('Question paper not found.')


def _norm_part(part):
    normalized = (part or '').strip().lower()
    return normalized or None


def _map_question_type(qtype):
    mapped = (qtype or '').strip().upper()
    if mapped == 'MCQ':
        return 'MCQ'
    if mapped in ('DRAW', 'DRAWING'):
        return 'DRAW'
    return 'THEORY'


def _db_question_rows(paper):
    return [
        {
            'section': q.section or '',
            'question_number': q.question_number,
            'part': q.part or '',
            'text_content': q.text_content or '',
            'question_type': q.question_type,
            'marks': q.marks or 0,
        }
        for q in paper.questions.all().order_by('section', 'question_number', 'part')
    ]


def _payload_rows(payload):
    if isinstance(payload, dict):
        rows = payload.get('questions') or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []
    return [row for row in rows if isinstance(row, dict)]


def _normalize_rows(rows):
    """Group flat question rows into app-facing items with sub-questions.

    Rows sharing (section, question_number) collapse into one item whose
    subQuestions carry individual labels (Q1(a)), parts, text and marks.
    Accepts DB snake_case rows as well as decrypted vault payload keys.
    """
    groups = {}
    for row in rows:
        section = row.get('section') or ''
        number = row.get('question_number', row.get('questionNumber')) or 0
        part = _norm_part(row.get('part'))
        group = groups.setdefault(
            (section, number),
            {'section': section, 'question_number': number, 'subs': []},
        )
        group['subs'].append({
            'label': f'Q{number}({part})' if part else f'Q{number}',
            'part': part or '',
            'questionNumber': number,
            'questionText': row.get('text_content', row.get('questionText', '')) or '',
            'marks': row.get('marks') or 0,
            'type': _map_question_type(row.get('question_type', row.get('type'))),
        })

    items = []
    for group in groups.values():
        subs = group['subs']
        if len(subs) == 1 and not subs[0]['part']:
            solo = {k: v for k, v in subs[0].items() if k not in ('label', 'part')}
            solo['section'] = group['section']
            solo['subQuestions'] = []
            items.append(solo)
        else:
            items.append({
                'questionNumber': group['question_number'],
                'section': group['section'],
                'questionText': '\n'.join(sub['questionText'] for sub in subs),
                'marks': sum(sub['marks'] for sub in subs),
                'type': subs[0]['type'],
                'subQuestions': subs,
            })
    return items


def _student_entitled(student, exam_session, subject):
    """Require a non-revoked hall ticket; a seat once seat maps exist."""
    from eligibility.models import HallTicket
    from scheduling.models import TimetableSlot

    if student is None:
        return False
    has_ticket = HallTicket.objects.filter(
        student=student, exam_session=exam_session, is_revoked=False,
    ).exists()
    if not has_ticket:
        return False
    seat_maps = [
        slot.seat_map or {}
        for slot in TimetableSlot.objects.filter(
            exam_session=exam_session, subject=subject, status__in=_SLOT_STATUSES,
        )
    ]
    if not any(seat_maps):
        return True  # seating not yet allocated - the ticket alone is enough
    usn = str(student.usn)
    return any(usn in seat_map for seat_map in seat_maps)


def _find_exam_slot(exam_session, subject):
    """Slot that gates the paper release for this exam.

    Active (SCHEDULED/CONFIRMED) slots always beat RESCHEDULED history so a
    stale reschedule row can never move the exam window; RESCHEDULED is only
    a fallback when no active slot exists. Today's slot first, then the next
    upcoming one.
    """
    from scheduling.models import TimetableSlot

    today = timezone.localdate()
    active = ('SCHEDULED', 'CONFIRMED')
    candidates = [
        (active, {'exam_date': today}, ('-start_time',)),
        (_SLOT_STATUSES, {'exam_date': today}, ('-start_time',)),
        (active, {'exam_date__gte': today}, ('exam_date', '-start_time')),
        (_SLOT_STATUSES, {'exam_date__gte': today}, ('exam_date', '-start_time')),
    ]
    for statuses, date_filter, ordering in candidates:
        slot = TimetableSlot.objects.filter(
            exam_session=exam_session,
            subject=subject,
            status__in=statuses,
            **date_filter,
        ).order_by(*ordering).first()
        if slot is not None:
            return slot
    return None


def _cie_release_content(raw, max_marks):
    """Parse CIE paper content: JSON when possible, sectioned text otherwise."""
    import re

    try:
        content = json.loads(raw or '')
        if isinstance(content, dict):
            return content
        if isinstance(content, list):
            return {"questions": content}
    except (ValueError, TypeError):
        pass

    raw = raw or ''
    questions = []
    parts = re.split(r'(?:^|\n)\s*(Q?\s*\d+\s*[)\.])', raw)
    idx = 1
    q_num = 1
    while idx < len(parts):
        body = parts[idx + 1].strip() if idx + 1 < len(parts) else ''
        idx += 2
        marks_match = re.search(r'\[(\d+)M\]', body)
        marks = int(marks_match.group(1)) if marks_match else 5
        text = re.sub(r'\[(?:\d+M|CO\d+|L\d+)\]', '', body).strip().strip('\n').strip()
        if text:
            questions.append({
                "questionNumber": q_num,
                "questionText": text,
                "marks": marks,
                "type": "THEORY",
            })
            q_num += 1

    if not questions:
        questions = [{
            "questionNumber": 1,
            "questionText": raw,
            "marks": max_marks,
            "type": "THEORY",
        }]
    return {"questions": questions}


class QuestionPaperViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaper.objects.all()
    serializer_class = QuestionPaperSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser | IsChiefSuperintendent])
    def assign_setter(self, request):
        from users.models import User
        from scheduling.models import Subject, ExamSession
        setter_id = request.data.get('setter_id')
        subject_id = request.data.get('subject_id')
        session_id = request.data.get('session_id')
        
        if not all([setter_id, subject_id, session_id]):
            return Response({"error": "setter_id, subject_id, and session_id are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            setter = User.objects.get(id=setter_id, role='PAPER_SETTER')
            subject = Subject.objects.get(id=subject_id)
            session = ExamSession.objects.get(id=session_id)
            
            qp, created = QuestionPaper.objects.get_or_create(
                setter=setter,
                subject=subject,
                exam_session=session,
                defaults={
                    "title": f"{subject.name} Official Paper",
                    "total_marks": 100,
                    "duration_mins": 180,
                    "status": "DRAFT"
                }
            )
            return Response({"message": f"Successfully assigned {subject.code} to {setter.full_name}."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        user = self.request.user
        if user.role == "PAPER_SETTER":
            return QuestionPaper.objects.filter(setter=user)
        elif user.role == "CHIEF_SUPERINTENDENT":
            return QuestionPaper.objects.all()
        return QuestionPaper.objects.none()

    @action(detail=True, methods=['post'], permission_classes=[IsPaperSetter])
    def sync_questions(self, request, pk=None):
        """
        Syncs all questions for this draft paper from the frontend.
        Expects a JSON array of questions in request.data['questions'].
        """
        from .models import Question
        paper = self.get_object()
        
        if paper.status != QuestionPaper.PaperStatus.DRAFT:
            return Response({"error": "Can only edit draft papers."}, status=status.HTTP_400_BAD_REQUEST)
            
        questions_data = request.data.get('questions', [])
        
        # To handle syncing simply, we clear existing questions and bulk recreate them
        # since the frontend maintains the full source of truth in its draft state.
        paper.questions.all().delete()
        
        new_questions = []
        for q_data in questions_data:
            bloom_mapping = {
                'Remember': Question.BloomLevel.REMEMBER,
                'Understand': Question.BloomLevel.UNDERSTAND,
                'Apply': Question.BloomLevel.APPLY,
                'Analyze': Question.BloomLevel.ANALYZE,
                'Evaluate': Question.BloomLevel.EVALUATE,
                'Create': Question.BloomLevel.CREATE,
            }
            bloom_level = bloom_mapping.get(q_data.get('bloomsLevel'), Question.BloomLevel.UNDERSTAND)
            
            # Map part
            part_str = q_data.get('part', '')
            if not part_str:
                part_str = ''
                
            q_number = q_data.get('number', 1)
            try:
                q_number = int(q_number)
            except ValueError:
                q_number = 1
                
            new_questions.append(
                Question(
                    question_paper=paper,
                    section=q_data.get('section', 'Part A'),
                    question_number=q_number,
                    part=part_str,
                    text_content=q_data.get('text', ''),
                    marks=q_data.get('marks', 0),
                    bloom_level=bloom_level,
                    # Storing coMapping, module, schemeNotes in extra metadata if we want,
                    # but for now we just map the core fields needed.
                )
            )
            
        Question.objects.bulk_create(new_questions)
        
        # Update total marks
        paper.total_marks = sum(q.marks for q in new_questions)
        paper.save()
        
        return Response({"status": "synced", "total_marks": paper.total_marks}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsPaperSetter])
    def lock_and_submit(self, request, pk=None):
        """
        Finalizes the paper, encrypts it, uploads it to IPFS, and submits to CoE.
        """
        paper = self.get_object()
        if paper.status != QuestionPaper.PaperStatus.DRAFT:
            return Response({"error": "Only draft papers can be locked."}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = PaperLockSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # 1. Generate PDF or JSON payload of the entire paper
        paper_data = QuestionPaperSerializer(paper).data
        from django.core.serializers.json import DjangoJSONEncoder
        payload_bytes = json.dumps(paper_data, cls=DjangoJSONEncoder).encode('utf-8')

        # 2. Generate AES-256 key
        aes_key = generate_aes_key()

        # 3. Encrypt payload
        encrypted_payload = encrypt_payload(aes_key, payload_bytes)

        # 4. Upload to IPFS
        cid = upload_to_ipfs(encrypted_payload)

        # 5. Encrypt and store the AES key (simulating secure backend vault)
        paper.ipfs_cid = cid
        paper.aes_key_hash = hash_key(aes_key)
        paper.encrypted_aes_key = encrypt_aes_key(aes_key)
        paper.key_unlock_timestamp = serializer.validated_data['key_unlock_timestamp']
        paper.status = QuestionPaper.PaperStatus.SUBMITTED
        paper.save()

        return Response({"status": "locked", "ipfs_cid": cid})

    @action(detail=True, methods=['post'], permission_classes=[IsChiefSuperintendent])
    def approve(self, request, pk=None):
        """CoE approves the submitted paper."""
        paper = self.get_object()
        if paper.status != QuestionPaper.PaperStatus.SUBMITTED:
            return Response({"error": "Paper must be in SUBMITTED state to be approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        paper.status = QuestionPaper.PaperStatus.APPROVED
        paper.approved_by = request.user
        paper.approved_at = timezone.now()
        paper.save()

        # Depending on workflow, it might go straight to ENCRYPTED. We'll set it to ENCRYPTED.
        # It's technically already encrypted and locked since lock_and_submit.
        paper.status = QuestionPaper.PaperStatus.ENCRYPTED
        paper.save()
        
        return Response({"status": "approved", "vault_status": paper.status})

    @action(detail=True, methods=['get'], permission_classes=[IsChiefSuperintendent])
    def unlock(self, request, pk=None):
        """
        Unlocks the AES key if the unlock time has passed.
        Allows the CoE to retrieve the decrypted paper contents.
        """
        paper = self.get_object()
        
        if paper.status not in [QuestionPaper.PaperStatus.ENCRYPTED, QuestionPaper.PaperStatus.DISTRIBUTED]:
            return Response({"error": "Paper is not in vault."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not paper.key_unlock_timestamp or timezone.now() < paper.key_unlock_timestamp:
            return Response({"error": "Unlock time has not been reached yet."}, status=status.HTTP_403_FORBIDDEN)
        
        # Mark as distributed
        if paper.status == QuestionPaper.PaperStatus.ENCRYPTED:
            paper.status = QuestionPaper.PaperStatus.DISTRIBUTED
            paper.key_distributed_at = timezone.now()
            paper.save()

        # Decrypt key
        aes_key = decrypt_aes_key(paper.encrypted_aes_key)

        # Fetch payload from IPFS
        encrypted_payload = fetch_from_ipfs(paper.ipfs_cid)

        # Decrypt payload
        try:
            decrypted_payload = decrypt_payload(aes_key, encrypted_payload)
            paper_content = json.loads(decrypted_payload.decode('utf-8'))
        except Exception as e:
            return Response({"error": "Failed to decrypt paper payload."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "unlocked",
            "aes_key_hex": aes_key.hex(),
            "content": paper_content
        })

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def time_release(self, request, pk=None):
        """Release the question paper inside the exam window.

        Accessible from 2 minutes before the exam start until 48 hours after
        it; when no slot is scheduled there is no window to enforce. Every
        created paper is released to entitled students regardless of the order
        in which the schedule and the paper were set up - only REJECTED papers
        are refused.
        """
        try:
            import logging
            logging.basicConfig(filename='E:\\NexAI\\BackEnd\\debug.log', level=logging.DEBUG)
            logging.debug(f'time_release called with pk={pk}')
        except Exception:
            pass

        from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
        from users.models import Student

        paper, is_scrutiny = _lookup_release_target(pk)
        is_cie_session = bool(
            getattr(paper, 'exam_session', None)
            and 'CIE' in (paper.exam_session.name or '').upper()
        )

        # ---- resolve the exam start datetime -----------------------------
        if is_scrutiny:
            config = paper.cie_config
            if not config.scheduled_date or not config.scheduled_time:
                return Response({"error": "CIE Date/Time not set."}, status=status.HTTP_400_BAD_REQUEST)
            exam_start_dt = timezone.make_aware(
                datetime.combine(config.scheduled_date, config.scheduled_time)
            )
        elif is_cie_session:
            config = CIEConfiguration.objects.filter(
                exam_session=paper.exam_session, subject=paper.subject,
            ).first()
            if not config:
                return Response({"error": "CIE Configuration not found."}, status=status.HTTP_404_NOT_FOUND)
            if not config.scheduled_date or not config.scheduled_time:
                return Response({"error": "CIE Date/Time not set."}, status=status.HTTP_400_BAD_REQUEST)
            exam_start_dt = timezone.make_aware(
                datetime.combine(config.scheduled_date, config.scheduled_time)
            )
        else:
            # Active slots win over RESCHEDULED history; none -> no window.
            slot = _find_exam_slot(paper.exam_session, paper.subject)
            # No slot -> no window to enforce; an entitled student still gets
            # the paper (creation order of schedule vs paper does not matter).
            exam_start_dt = None
            if slot and slot.start_time and slot.exam_date:
                exam_start_dt = timezone.make_aware(
                    datetime.combine(slot.exam_date, slot.start_time)
                )

        # ---- entitlement: only the student's own exam paper ---------------
        if not is_scrutiny and not is_cie_session:
            student = Student.objects.filter(user=request.user).first()
            if not _student_entitled(student, paper.exam_session, paper.subject):
                return Response(
                    {"error": "You are not eligible for this exam."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # ---- approval gate: drafts are never released ---------------------
        if is_scrutiny:
            if paper.status != CIEQuestionPaperScrutiny.ScrutinyStatus.APPROVED:
                return Response({"error": "CIE paper not approved yet."}, status=status.HTTP_400_BAD_REQUEST)
        elif paper.status not in _RELEASEABLE_STATUSES:
            return Response(
                {"error": "Question paper not approved yet."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ---- exam window: 2 min before start until 48 h after -------------
        if exam_start_dt is not None:
            time_until_exam = exam_start_dt - timezone.now()
            if time_until_exam > _PAPER_EARLY_WINDOW:
                return Response(
                    {
                        "error": "Too early to fetch paper.",
                        "remaining_seconds": int(
                            time_until_exam.total_seconds() - _PAPER_EARLY_WINDOW.total_seconds()
                        ),
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if time_until_exam < -_PAPER_ACCESS_WINDOW:
                return Response(
                    {"error": "Exam session has ended. Paper is no longer accessible."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # ---- content ------------------------------------------------------
        if is_scrutiny:
            config = paper.cie_config
            return Response({
                "status": "unlocked",
                "duration_mins": getattr(config, 'duration_mins', 180),
                "total_marks": getattr(config, 'max_marks', 100),
                "subject_code": config.subject.code if getattr(config, 'subject_id', None) else "",
                "instructions": getattr(config, 'instructions', '') or '',
                "exam_session_name": config.exam_session.name if getattr(config, 'exam_session_id', None) else "",
                "content": _cie_release_content(
                    paper.paper_content, getattr(config, 'max_marks', 100)
                ),
            })

        rows = _db_question_rows(paper)
        questions = _normalize_rows(rows) if rows else []
        if not questions and paper.status in (
            QuestionPaper.PaperStatus.ENCRYPTED,
            QuestionPaper.PaperStatus.DISTRIBUTED,
        ):
            # Vault-only copy: decrypt the IPFS payload when DB rows are gone.
            try:
                aes_key = decrypt_aes_key(paper.encrypted_aes_key)
                encrypted_payload = fetch_from_ipfs(paper.ipfs_cid)
                decrypted_payload = decrypt_payload(aes_key, encrypted_payload)
                payload = json.loads(decrypted_payload.decode('utf-8'))
                questions = _normalize_rows(_payload_rows(payload))
            except Exception:
                questions = []

        return Response({
            "status": "unlocked",
            "duration_mins": paper.duration_mins,
            "total_marks": sum(item["marks"] for item in questions),
            "subject_code": paper.subject.code if paper.subject_id else "",
            "instructions": paper.instructions or "",
            "exam_session_name": paper.exam_session.name if paper.exam_session_id else "",
            "content": {"questions": questions},
        })

    @action(detail=False, methods=['get'], permission_classes=[])
    def dump_questions(self, request):
        from vault.models import QuestionPaper
        from cie.models import CIEQuestionPaperScrutiny, CIEConfiguration
        from scheduling.models import TimetableSlot
        return Response({
            'question_papers': QuestionPaper.objects.count(),
            'cie_scrutinies': CIEQuestionPaperScrutiny.objects.count(),
            'cie_configs': CIEConfiguration.objects.count(),
            'timetable_slots': TimetableSlot.objects.count()
        })


