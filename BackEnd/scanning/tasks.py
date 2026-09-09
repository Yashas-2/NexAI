"""NexAI Scanning – Celery Tasks"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_booklet_packet(self, packet_id: str):
    """
    Background task triggered after a booklet is uploaded.
    1. Links the booklet to the correct Student record via USN.
    2. Updates the packet status accordingly.
    """
    from .models import BookletPacket
    from users.models import Student

    try:
        packet = BookletPacket.objects.get(id=packet_id)
        packet.status = BookletPacket.PacketStatus.PROCESSING
        packet.save(update_fields=['status'])

        # Attempt to match the USN to an existing Student record
        try:
            student = Student.objects.get(usn__iexact=packet.student_usn.strip())
            packet.student = student
            packet.status = BookletPacket.PacketStatus.LINKED
            logger.info(f"Booklet {packet_id} linked to student {student.usn}")
        except Student.DoesNotExist:
            packet.status = BookletPacket.PacketStatus.FAILED
            packet.error_message = f"No student found with USN '{packet.student_usn}'"
            logger.warning(f"Booklet {packet_id}: USN '{packet.student_usn}' not found")

        packet.processed_at = timezone.now()
        packet.save(update_fields=['student', 'status', 'processed_at', 'error_message'])

    except BookletPacket.DoesNotExist:
        logger.error(f"BookletPacket {packet_id} does not exist.")
    except Exception as exc:
        logger.error(f"Error processing booklet {packet_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)
