"""
NexAI Users – Extended User Model + StudentProfile
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from .constants import UserRole


class UserManager(BaseUserManager):
    """Custom manager for email-based auth (no username field)."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.CHIEF_SUPERINTENDENT)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Central NexAI user model.
    Identity is email-based; role field controls dashboard access.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identity ──────────────────────────────────────────────────────────────
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=15, blank=True)
    employee_id = models.CharField(max_length=50, blank=True, unique=True, null=True)

    # ── Role ──────────────────────────────────────────────────────────────────
    role = models.CharField(
        max_length=30,
        choices=UserRole.CHOICES,
        default=UserRole.STUDENT,
        db_index=True,
    )
    historical_duties_count = models.IntegerField(default=0)

    # ── Department link (for staff) ───────────────────────────────────────────
    department = models.ForeignKey(
        "users.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_members",
    )

    # ── Insecure Password Storage (Requested for Dev) ─────────────────────────
    plain_password = models.CharField(max_length=128, null=True, blank=True)

    # ── Status ────────────────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "role"]

    class Meta:
        db_table = "users_user"
        ordering = ["-created_at"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.full_name} <{self.email}> [{self.role}]"

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT

    @property
    def is_coe(self):
        return self.role == UserRole.CHIEF_SUPERINTENDENT

    def has_role(self, *roles) -> bool:
        """Convenience check: user.has_role('HOD', 'CHIEF_SUPERINTENDENT')"""
        return self.role in roles


class Department(models.Model):
    """Academic department – scopes HOD access."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10, unique=True)
    hod = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hod_department",
        limit_choices_to={"role": UserRole.HOD},
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users_department"

    def __str__(self):
        return f"{self.code} – {self.name}"


class Student(models.Model):
    """
    Student profile extending the User model.
    Stores academic identity (USN), current semester, batch year,
    and subject enrollments.
    """

    class SemesterChoices(models.IntegerChoices):
        SEM1 = 1, "Semester 1"
        SEM2 = 2, "Semester 2"
        SEM3 = 3, "Semester 3"
        SEM4 = 4, "Semester 4"
        SEM5 = 5, "Semester 5"
        SEM6 = 6, "Semester 6"
        SEM7 = 7, "Semester 7"
        SEM8 = 8, "Semester 8"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="student_profile",
        limit_choices_to={"role": UserRole.STUDENT},
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="students",
    )

    # ── Academic Identity ────────────────────────────────────────────────────
    usn = models.CharField(
        max_length=20,
        unique=True,
        help_text="University Serial Number, e.g. 1XX21CS001",
    )
    current_semester = models.PositiveSmallIntegerField(
        choices=SemesterChoices.choices,
        default=1,
    )
    batch_year = models.PositiveSmallIntegerField(
        help_text="Year of joining, e.g. 2022",
    )
    is_lateral_entry = models.BooleanField(default=False)
    section = models.CharField(
        max_length=5,
        default="A",
        help_text="Class section, e.g. A, B, C",
    )

    # ── Eligibility Snapshot (updated by HOD uploads) ────────────────────────
    overall_attendance_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00
    )
    is_eligible_for_exam = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_student"
        ordering = ["usn"]

    def __str__(self):
        return f"{self.usn} – {self.user.full_name} (Sem {self.current_semester})"

    @property
    def full_name(self):
        return self.user.full_name

    @property
    def email(self):
        return self.user.email


class BiometricProfile(models.Model):
    """Stores FaceNet 512-d embedding for a student's biometric identity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="biometric_profile",
        limit_choices_to={"role": UserRole.STUDENT},
    )
    face_embedding = models.JSONField(
        help_text="512-dimensional FaceNet embedding vector stored as JSON array."
    )
    device_hash = models.CharField(max_length=128, blank=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "users_biometric_profile"

    def __str__(self):
        return f"Biometric: {self.student.full_name}"
