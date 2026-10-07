import json
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
        """
        Allows a student to fetch the question paper exactly 2 minutes before the exam start time.
        """
        from django.http import Http404
        from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
        try:
            paper = self.get_object()
            is_cie_scrutiny = False
        except Http404:
            # Fallback for CIE exams which use CIEQuestionPaperScrutiny instead of QuestionPaper
            try:
                scrutiny = CIEQuestionPaperScrutiny.objects.get(pk=pk)
                paper = scrutiny
                is_cie_scrutiny = True
            except CIEQuestionPaperScrutiny.DoesNotExist:
                raise Http404

        # Ensure student is eligible for this exam session/subject
        from scheduling.models import StudentSubjectEnrollment, TimetableSlot
        from datetime import timedelta, datetime
        import pytz

        is_cie = getattr(paper, 'exam_session', None) and 'CIE' in paper.exam_session.name.upper()

        if is_cie_scrutiny:
            cie_config = paper.cie_config
            if not cie_config.scheduled_date or not cie_config.scheduled_time:
                return Response({"error": "CIE Date/Time not set."}, status=status.HTTP_400_BAD_REQUEST)
            
            exam_start_dt = datetime.combine(cie_config.scheduled_date, cie_config.scheduled_time)
            # Make it aware
            exam_start_dt = timezone.make_aware(exam_start_dt)
        elif is_cie:
            cie_config = CIEConfiguration.objects.filter(exam_session=paper.exam_session, subject=paper.subject).first()
            if not cie_config:
                return Response({"error": "CIE Configuration not found."}, status=status.HTTP_404_NOT_FOUND)
            if not cie_config.scheduled_date or not cie_config.scheduled_time:
                return Response({"error": "CIE Date/Time not set."}, status=status.HTTP_400_BAD_REQUEST)
            
            exam_start_dt = datetime.combine(cie_config.scheduled_date, cie_config.scheduled_time)
            # Make it aware
            exam_start_dt = timezone.make_aware(exam_start_dt)
        else:
            from django.utils.timezone import localdate
            from datetime import date as _date

            today = localdate()

            # Priority 1: slot on today's date (student is sitting today)
            slot = TimetableSlot.objects.filter(
                exam_session=paper.exam_session,
                subject=paper.subject,
                exam_date=today,
            ).first()

            # Priority 2: next upcoming slot (covers the case where the student
            # checks early on a future day — they get that day's unlock window)
            if not slot:
                slot = TimetableSlot.objects.filter(
                    exam_session=paper.exam_session,
                    subject=paper.subject,
                    exam_date__gte=today,
                ).order_by('exam_date', 'start_time').first()

            if not slot or not slot.start_time or not slot.exam_date:
                return Response(
                    {"error": "Timetable slot not found or not scheduled."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            exam_start_dt = datetime.combine(slot.exam_date, slot.start_time)
            exam_start_dt = timezone.make_aware(exam_start_dt)


        now = timezone.now()
        time_until_exam = exam_start_dt - now

        if time_until_exam > timedelta(minutes=2):
            return Response({
                "error": "Too early to fetch paper.",
                "remaining_seconds": int(time_until_exam.total_seconds() - 120)
            }, status=status.HTTP_403_FORBIDDEN)

        # Retrieve and decrypt
        if is_cie_scrutiny:
            if paper.status != CIEQuestionPaperScrutiny.ScrutinyStatus.APPROVED:
                return Response({"error": "CIE paper not approved yet."}, status=status.HTTP_400_BAD_REQUEST)
            
            import json, re
            try:
                content = json.loads(paper.paper_content)
            except Exception:
                raw = paper.paper_content or ''
                questions = []
                # Split by Q1), Q2), 1), 2), 1., etc. (allowing leading spaces)
                parts = re.split(r'(?:^|\n)\s*(Q?\s*\d+\s*[)\.])', raw)
                # parts[0] is before Q1), then alternating marker/content
                idx = 1
                q_num = 1
                while idx < len(parts):
                    marker = parts[idx].strip()  # e.g. "Q1)" or "1)"
                    body = parts[idx + 1].strip() if idx + 1 < len(parts) else ''
                    idx += 2

                    # Extract marks from [10M]
                    marks_match = re.search(r'\[(\d+)M\]', body)
                    marks = int(marks_match.group(1)) if marks_match else 5

                    # Extract CO from [CO1]
                    co_match = re.search(r'\[CO\d+\]', body)

                    # Extract Bloom's from [L3]
                    bloom_match = re.search(r'\[L\d+\]', body)

                    # Question text is everything after the metadata tags
                    text = re.sub(r'\[(?:\d+M|CO\d+|L\d+)\]', '', body).strip()
                    # Remove leading/trailing newlines
                    text = text.strip('\n').strip()

                    if text:
                        questions.append({
                            "questionNumber": q_num,
                            "questionText": text,
                            "marks": marks,
                            "type": "THEORY"
                        })
                        q_num += 1

                if not questions:
                    # Ultimate fallback: single question with full content
                    questions = [{
                        "questionNumber": 1,
                        "questionText": raw,
                        "marks": paper.cie_config.max_marks,
                        "type": "THEORY"
                    }]

                content = {"questions": questions}
            
            return Response({
                "status": "unlocked",
                "duration_mins": paper.cie_config.duration_mins,
                "content": content
            })

        if paper.status not in [QuestionPaper.PaperStatus.ENCRYPTED, QuestionPaper.PaperStatus.DISTRIBUTED]:
            # Mock mode: return empty questions if paper is not fully encrypted/vaulted yet
            if paper.status in [QuestionPaper.PaperStatus.DRAFT, QuestionPaper.PaperStatus.APPROVED, QuestionPaper.PaperStatus.SUBMITTED, QuestionPaper.PaperStatus.SCRUTINIZED]:
                questions_data = []
                for q in paper.questions.all().order_by('question_number'):
                    questions_data.append({
                        "questionNumber": q.question_number,
                        "questionText": q.text_content,
                        "marks": q.marks,
                        "type": q.question_type,
                    })
                
                if not questions_data:
                    questions_data = [
                        {"questionNumber": 1, "questionText": "Draft Mode: Faculty has not added questions yet.", "marks": 0, "type": "THEORY"}
                    ]

                return Response({
                    "status": "unlocked_draft",
                    "content": {
                        "questions": questions_data
                    }
                })
            return Response({"error": "Paper is not in vault."}, status=status.HTTP_400_BAD_REQUEST)

        aes_key = decrypt_aes_key(paper.encrypted_aes_key)
        encrypted_payload = fetch_from_ipfs(paper.ipfs_cid)

        try:
            decrypted_payload = decrypt_payload(aes_key, encrypted_payload)
            paper_content = json.loads(decrypted_payload.decode('utf-8'))
        except Exception as e:
            return Response({"error": "Failed to decrypt paper payload."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "unlocked",
            "content": paper_content
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


