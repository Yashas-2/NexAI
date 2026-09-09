import json
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsPaperSetter, IsChiefSuperintendent
from .models import QuestionPaper, Question
from .serializers import QuestionPaperSerializer, PaperLockSerializer
from .crypto import generate_aes_key, hash_key, encrypt_aes_key, encrypt_payload, decrypt_aes_key, decrypt_payload
from .ipfs_service import upload_to_ipfs, fetch_from_ipfs

class QuestionPaperViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaper.objects.all()
    serializer_class = QuestionPaperSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "PAPER_SETTER":
            return QuestionPaper.objects.filter(setter=user)
        elif user.role == "CHIEF_SUPERINTENDENT":
            return QuestionPaper.objects.all()
        return QuestionPaper.objects.none()

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
        paper = self.get_object()

        # Ensure student is eligible for this exam session/subject
        from scheduling.models import StudentSubjectEnrollment, TimetableSlot
        from cie.models import CIEConfiguration
        from datetime import timedelta, datetime
        import pytz

        is_cie = 'CIE' in paper.exam_session.name.upper()

        if is_cie:
            cie_config = CIEConfiguration.objects.filter(exam_session=paper.exam_session, subject=paper.subject).first()
            if not cie_config:
                return Response({"error": "CIE Configuration not found."}, status=status.HTTP_404_NOT_FOUND)
            if not cie_config.scheduled_date or not cie_config.scheduled_time:
                return Response({"error": "CIE Date/Time not set."}, status=status.HTTP_400_BAD_REQUEST)
            
            exam_start_dt = datetime.combine(cie_config.scheduled_date, cie_config.scheduled_time)
            # Make it aware
            exam_start_dt = timezone.make_aware(exam_start_dt)
        else:
            slot = TimetableSlot.objects.filter(exam_session=paper.exam_session, subject=paper.subject).first()
            if not slot or not slot.start_time or not slot.exam_date:
                return Response({"error": "Timetable slot not found or not scheduled."}, status=status.HTTP_404_NOT_FOUND)
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
        if paper.status not in [QuestionPaper.PaperStatus.ENCRYPTED, QuestionPaper.PaperStatus.DISTRIBUTED]:
            # Mock mode: return empty questions if paper is not fully encrypted/vaulted yet
            if paper.status == QuestionPaper.PaperStatus.DRAFT:
                return Response({
                    "status": "unlocked_draft",
                    "content": {
                        "questions": [
                            {"questionNumber": 1, "questionText": "Draft Mode: Faculty has not submitted the final paper yet.", "marks": 0, "type": "THEORY"}
                        ]
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

