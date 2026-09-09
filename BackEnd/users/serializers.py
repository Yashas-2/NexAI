"""NexAI Users – Serializers"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Department, BiometricProfile

User = get_user_model()


class NexAITokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extend JWT token payload with role, name, and department."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        token["email"] = user.email
        if user.department:
            token["department_id"] = str(user.department.id)
            token["department_code"] = user.department.code
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Append user info to response body too
        data["user"] = {
            "id": str(self.user.id),
            "email": self.user.email,
            "full_name": self.user.full_name,
            "role": self.user.role,
        }
        if self.user.department:
            data["user"]["department_id"] = str(self.user.department.id)
            data["user"]["department_code"] = self.user.department.code
        return data


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]


class UserSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    usn = serializers.CharField(source='student_profile.usn', read_only=True, default=None)
    semester = serializers.IntegerField(source='student_profile.current_semester', read_only=True, default=None)

    # Allow write for basic user fields and nested fields
    write_usn = serializers.CharField(write_only=True, required=False)
    write_semester = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "employee_id",
            "role", "department", "is_active", "created_at", "plain_password",
            "usn", "semester", "write_usn", "write_semester"
        ]
        read_only_fields = ["id", "created_at", "plain_password"]

    def update(self, instance, validated_data):
        write_usn = validated_data.pop('write_usn', None)
        write_semester = validated_data.pop('write_semester', None)

        # Update base User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Student profile fields if applicable
        if instance.role == "STUDENT" and hasattr(instance, 'student_profile'):
            student = instance.student_profile
            if write_usn is not None:
                student.usn = write_usn
            if write_semester is not None:
                student.current_semester = write_semester
            student.save(update_fields=['usn', 'current_semester'])

        return instance


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "email", "full_name", "phone", "employee_id",
            "role", "department", "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.plain_password = password
        user.save()
        return user


class BiometricEnrollSerializer(serializers.Serializer):
    """Accepts a 512-d face embedding from the mobile client."""
    face_embedding = serializers.ListField(
        child=serializers.FloatField(),
        min_length=512,
        max_length=512,
    )
    device_hash = serializers.CharField(max_length=128, required=False)


class BiometricVerifySerializer(serializers.Serializer):
    """Live face embedding to verify against stored profile."""
    face_embedding = serializers.ListField(
        child=serializers.FloatField(),
        min_length=512,
        max_length=512,
    )


class StudentSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source="user", read_only=True)
    department_details = DepartmentSerializer(source="department", read_only=True)

    class Meta:
        from .models import Student
        model = Student
        fields = [
            "id", "user", "department", "usn", "current_semester",
            "batch_year", "overall_attendance_pct", "is_eligible_for_exam",
            "user_details", "department_details", "created_at"
        ]
        read_only_fields = ["id", "created_at", "is_eligible_for_exam"]
