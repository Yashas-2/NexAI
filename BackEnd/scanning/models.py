"""
NexAI Scanning – ScanningSession and BookletPacket models.
A ScanningSession is opened by an Invigilator for a specific TimetableSlot.
"""
import uuid
from django.db import models


class ScanningSession(models.Model):
    """
    Time-bound, room-specific, geofenced session authorizing
    an Invigilator to upload scanned booklets.
    """

    class SessionStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Activation"
        ACTIVE = "ACTIVE", "Active"
        EXPIRED = "EXPIRED", "Expired"
        CLOSED = "CLOSED", "Manually Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable_slot = models.ForeignKey(
        "scheduling.TimetableSlot",
        on_delete=models.PROTECT,
        related_name="scanning_sessions",
    )
    invigilator = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="scanning_sessions",
        limit_choices_to={"role": "INVIGILATOR"},
    )

    session_token = models.UUIDField(
        default=uuid.uuid4, unique=True,
        help_text="One-time token sent to the mobile app for session validation",
    )

    # ── Geofence ──────────────────────────────────────────────────────────────
    geofence_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    geofence_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    geofence_radius_m = models.PositiveSmallIntegerField(
        default=200,
        help_text="Allowed radius in meters from the room coordinates",
    )

    status = models.CharField(
        max_length=10,
        choices=SessionStatus.choices,
        default=SessionStatus.PENDING,
        db_index=True,
    )

    activated_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scanning_session"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"Session {self.session_token} | "
            f"{self.timetable_slot} [{self.status}]"
        )


class BookletPacket(models.Model):
    """
    A single scanned answer booklet uploaded during a ScanningSession.
    Each packet is linked to a student (via USN) and an exam slot.
    """

    class PacketStatus(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        PROCESSING = "PROCESSING", "Processing"
        LINKED = "LINKED", "Linked to Student"
        FAILED = "FAILED", "Failed to Process"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scanning_session = models.ForeignKey(
        ScanningSession,
        on_delete=models.PROTECT,
        related_name="booklet_packets",
    )

    # The student this booklet belongs to (matched by USN on the cover page)
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booklet_packets",
    )

    # USN entered manually by the scanning officer (before AI links it to a student)
    student_usn = models.CharField(
        max_length=20,
        help_text="USN as written on the booklet cover page",
    )

    # Uploaded image / PDF file stored in MinIO via Django Storages
    booklet_file = models.FileField(
        upload_to="scanning/booklets/%Y/%m/",
        help_text="Scanned PDF or image of the answer booklet",
    )

    page_count = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=15,
        choices=PacketStatus.choices,
        default=PacketStatus.UPLOADED,
        db_index=True,
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "scanning_booklet_packet"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Booklet [{self.student_usn}] – {self.status}"
