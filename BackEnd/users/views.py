"""NexAI Users – API Views"""
import csv
import io
import uuid
import numpy as np
from django.db import models
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView

from .models import BiometricProfile, Department
from .constants import UserRole
from .serializers import (
    NexAITokenObtainPairSerializer,
    UserSerializer,
    UserCreateSerializer,
    BiometricEnrollSerializer,
    BiometricVerifySerializer,
    DepartmentSerializer,
)
from core.permissions import (
    IsChiefSuperintendent, 
    IsChiefSuperintendentOrHOD, 
    IsChiefSuperintendentOrHODOrAdmission,
    IsAdmissionOrCoE
)

User = get_user_model()

# --- Auth Views ---


class NexAILoginView(TokenObtainPairView):
    """Role-aware JWT login. Returns access + refresh tokens with role payload."""
    serializer_class = NexAITokenObtainPairSerializer
    permission_classes = [AllowAny]


class NexAIRefreshView(TokenRefreshView):
    """Refresh the access token."""


class NexAILogoutView(TokenBlacklistView):
    """Blacklist the refresh token on logout."""


# --- Department Views ---


class DepartmentListView(generics.ListAPIView):
    """List all departments. Accessible by any authenticated user."""
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Department.objects.all().order_by("name")


# --- User Management ---


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Return the currently authenticated user's profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserCreateView(generics.CreateAPIView):
    """Create a new user. CoE or HOD. Returns the plain-text password once."""
    serializer_class = UserCreateSerializer
    permission_classes = [IsChiefSuperintendentOrHOD]

    def create(self, request, *args, **kwargs):
        # Auto-assign department if user is HOD and no department is provided
        data = request.data.copy()
        if request.user.role == UserRole.HOD and request.user.department:
            if 'department' not in data or not data['department']:
                data['department'] = request.user.department.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        plain_password = request.data.get("password", "")
        return Response({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department.name if user.department else None,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "temp_password": plain_password,
        }, status=status.HTTP_201_CREATED)


class UserListView(generics.ListAPIView):
    """List users. CoE/Admission sees all; HOD sees only their department."""
    serializer_class = UserSerializer
    permission_classes = [IsChiefSuperintendentOrHODOrAdmission]
    filterset_fields = ["role", "department", "is_active"]
    search_fields = ["email", "full_name", "employee_id"]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all().select_related("department")
        if user.role == UserRole.HOD and user.department:
            qs = qs.filter(department=user.department)
        return qs.order_by("role", "full_name")


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update, retrieve, or delete specific user details. CoE, Admission, and HOD."""
    serializer_class = UserSerializer
    permission_classes = [IsChiefSuperintendentOrHODOrAdmission]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all()
        if user.role == UserRole.HOD and user.department:
            qs = qs.filter(department=user.department, role__in=[UserRole.STUDENT, UserRole.FACULTY])
        return qs


@api_view(["POST"])
@permission_classes([IsChiefSuperintendentOrHODOrAdmission])
def reset_user_password(request, pk):
    """COE resets a user's password, or HOD resets their department student's password."""
    try:
        user = User.objects.get(pk=pk)
        if request.user.role == UserRole.HOD:
            if user.department != request.user.department or user.role != UserRole.STUDENT:
                return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    new_password = request.data.get("new_password")
    if not new_password or len(new_password) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.plain_password = new_password
    user.save(update_fields=["password", "plain_password"])
    return Response({"success": "Password reset successfully.", "temp_password": new_password})


@api_view(["POST"])
@permission_classes([IsChiefSuperintendentOrHODOrAdmission])
def suspend_user(request, pk):
    """COE suspends a user, or HOD suspends their department student."""
    try:
        user = User.objects.get(pk=pk)
        if request.user.role == UserRole.HOD:
            if user.department != request.user.department or user.role != UserRole.STUDENT:
                return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = False
    user.save(update_fields=["is_active"])
    return Response({"success": f"User {user.email} suspended."})


@api_view(["POST"])
@permission_classes([IsChiefSuperintendentOrHODOrAdmission])
def restore_user(request, pk):
    """COE restores a suspended user, or HOD restores their department student."""
    try:
        user = User.objects.get(pk=pk)
        if request.user.role == UserRole.HOD:
            if user.department != request.user.department or user.role != UserRole.STUDENT:
                return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = True
    user.save(update_fields=["is_active"])
    return Response({"success": f"User {user.email} restored."})


@api_view(["DELETE"])
@permission_classes([IsChiefSuperintendentOrHODOrAdmission])
def bulk_delete_students(request):
    """Admin/HOD deletes all students in the system (or in their dept). CASCADE deletes everything."""
    user = request.user
    if user.role == UserRole.HOD and user.department:
        qs = User.objects.filter(role=UserRole.STUDENT, department=user.department)
    else:
        qs = User.objects.filter(role=UserRole.STUDENT)
        
    count = qs.count()
    qs.delete()  # This will CASCADE delete profiles, attempts, attendances
    
    return Response({"success": f"Successfully deleted {count} students and all their associated data."})


# --- Biometric Views ---


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def biometric_enroll(request):
    """Enroll or update the student's FaceNet biometric embedding."""
    serializer = BiometricEnrollSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    profile, created = BiometricProfile.objects.update_or_create(
        student=request.user,
        defaults={
            "face_embedding": serializer.validated_data["face_embedding"],
            "device_hash": serializer.validated_data.get("device_hash", ""),
        },
    )
    return Response({"success": True, "enrolled": True, "created": created}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def biometric_verify(request):
    """Verify a live face embedding against the stored profile."""
    serializer = BiometricVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        profile = BiometricProfile.objects.get(student=request.user)
    except BiometricProfile.DoesNotExist:
        return Response({"success": False, "error": "No biometric profile enrolled."}, status=status.HTTP_404_NOT_FOUND)

    stored = np.array(profile.face_embedding)
    live = np.array(serializer.validated_data["face_embedding"])
    similarity = float(np.dot(stored, live) / (np.linalg.norm(stored) * np.linalg.norm(live)))
    THRESHOLD = 0.85

    return Response({
        "success": True,
        "match": similarity >= THRESHOLD,
        "similarity": round(similarity, 4),
        "threshold": THRESHOLD,
    }, status=status.HTTP_200_OK)


# --- Bulk Student Import ---

# In-memory import log (use a DB model for production persistence)
_IMPORT_HISTORY = []


class BulkStudentImportView(APIView):
    """
    Accepts a CSV file and bulk-creates User + Student profile records.
    Columns: USN (required), Student_Name (required), Email (required),
             Password (optional – auto-generated if absent),
             Semester (optional, default=1), Department (optional)
    Rules:
    - Never deletes existing records from other departments.
    - Skips duplicate USNs/emails (reports them as warnings).
    - Admission role can only create STUDENT users.
    """
    permission_classes = [IsAdmissionOrCoE]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            csv_file = io.StringIO(file_obj.read().decode("utf-8-sig"))
            reader = csv.DictReader(csv_file)
        except Exception as e:
            return Response({"error": f"Invalid CSV. Ensure UTF-8 encoding. {e}"}, status=status.HTTP_400_BAD_REQUEST)

        imported_students = []
        skipped = []
        errors = []

        for row_num, row in enumerate(reader, start=1):
            try:
                usn = (row.get("USN") or row.get("usn", "")).strip()
                name = (row.get("Student_Name") or row.get("Name") or row.get("name", "")).strip()
                email = (row.get("Email") or row.get("email", "")).strip().lower()
                password = (row.get("Password") or row.get("password", "")).strip()
                semester = (row.get("Semester") or row.get("semester", "")).strip()
                dept_name = (row.get("Department") or row.get("department", "")).strip()
                section = (row.get("Section") or row.get("section", "A")).strip() or "A"

                if not all([usn, name, email]):
                    errors.append(f"Row {row_num}: Missing USN, Name, or Email.")
                    continue

                # Resolve department
                dept = None
                if dept_name:
                    from .models import Department as Dept
                    dept = Dept.objects.filter(
                        models.Q(name__icontains=dept_name) | models.Q(code__iexact=dept_name)
                    ).first()
                if not dept:
                    dept = getattr(request.user, 'department', None)
                if not dept:
                    errors.append(f"Row {row_num} ({usn}): Cannot resolve department '{dept_name}'.")
                    continue

                # Generate password if not provided
                if not password:
                    password = f"NexAI@{usn[-4:]}" if len(usn) >= 4 else str(uuid.uuid4())[:8]

                # Check for existing USN duplicate
                from users.models import Student
                if Student.objects.filter(usn=usn).exists():
                    skipped.append(f"Row {row_num}: USN '{usn}' already exists – skipped.")
                    continue

                # Check for existing email duplicate
                if User.objects.filter(email=email).exists():
                    skipped.append(f"Row {row_num}: Email '{email}' already exists – skipped.")
                    continue

                # Parse semester
                semester_num = 1
                if semester:
                    digits = "".join(filter(str.isdigit, semester))
                    if digits:
                        semester_num = max(1, min(8, int(digits)))

                # Create User
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    full_name=name,
                    role=UserRole.STUDENT,
                    department=dept,
                    plain_password=password,
                )

                # Create Student profile
                from django.utils import timezone
                student = Student.objects.create(
                    user=user,
                    usn=usn,
                    department=dept,
                    current_semester=semester_num,
                    batch_year=timezone.now().year,
                    section=section,
                )

                imported_students.append({
                    "id": str(student.id),
                    "usn": student.usn,
                    "name": user.full_name,
                    "email": user.email,
                    "semester": semester_num,
                    "department": dept.name,
                    "department_code": dept.code,
                    "section": section,
                    "temp_password": password,
                })
            except Exception as e:
                errors.append(f"Row {row_num} Error: {str(e)}")

        # Log this import batch
        from django.utils import timezone as tz
        _IMPORT_HISTORY.append({
            "imported_by": request.user.email,
            "imported_at": tz.now().isoformat(),
            "total_imported": len(imported_students),
            "total_skipped": len(skipped),
            "total_errors": len(errors),
        })

        return Response({
            "imported": len(imported_students),
            "skipped": len(skipped),
            "errors": errors + skipped,
            "students": imported_students,
        }, status=status.HTTP_200_OK)



class AdmissionImportHistoryView(APIView):
    """Returns the log of past bulk import batches."""
    permission_classes = [IsAdmissionOrCoE]

    def get(self, request, *args, **kwargs):
        return Response({"history": _IMPORT_HISTORY[-50:]}, status=status.HTTP_200_OK)


class StudentStatsView(APIView):
    """Returns live student counts from database for the admission dashboard."""
    permission_classes = [IsAdmissionOrCoE]

    def get(self, request, *args, **kwargs):
        from .models import Student as StudentModel
        from django.db.models import Count

        total = StudentModel.objects.count()
        by_dept = (
            StudentModel.objects
            .values("department__name", "department__code")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        departments = [{"name": d["department__name"], "code": d["department__code"], "count": d["count"]} for d in by_dept]
        return Response({
            "total_students": total,
            "departments": departments,
            "department_count": len(departments),
            "import_batches": len(_IMPORT_HISTORY),
        }, status=status.HTTP_200_OK)
