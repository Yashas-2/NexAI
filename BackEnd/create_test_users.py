import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.contrib.auth import get_user_model
from users.constants import UserRole

User = get_user_model()

def create_users():
    print("Creating test users...")
    users = [
        {"email": "coe@nexai.com", "password": "password123", "full_name": "Chief Superintendent", "role": UserRole.CHIEF_SUPERINTENDENT, "is_superuser": True},
        {"email": "hod@nexai.com", "password": "password123", "full_name": "Head of Department", "role": UserRole.HOD},
        {"email": "setter@nexai.com", "password": "password123", "full_name": "Question Paper Setter", "role": UserRole.PAPER_SETTER},
        {"email": "invigilator@nexai.com", "password": "password123", "full_name": "Invigilator", "role": UserRole.INVIGILATOR},
        {"email": "evaluator@nexai.com", "password": "password123", "full_name": "Central Evaluator", "role": UserRole.EVALUATOR},
        {"email": "scrutinizer@nexai.com", "password": "password123", "full_name": "Central Scrutinizer", "role": UserRole.SCRUTINIZER},
        {"email": "scanning@nexai.com", "password": "password123", "full_name": "Scanning Superintendent", "role": UserRole.SCANNING_OFFICER},
        {"email": "faculty@nexai.com", "password": "password123", "full_name": "Prof. Alan Turing (Faculty)", "role": UserRole.FACULTY},
    ]
    
    for u in users:
        if not User.objects.filter(email=u["email"]).exists():
            is_super = u.pop("is_superuser", False)
            if is_super:
                user_obj = User.objects.create_superuser(**u)
            else:
                user_obj = User.objects.create_user(**u)
            print(f"Created {u['role']} user: {u['email']} / password123")
        else:
            print(f"User {u['email']} already exists.")

    # Create Student
    from users.models import Department, Student
    dept, _ = Department.objects.get_or_create(code="CS", defaults={"name": "Computer Science"})
    
    student_user, created = User.objects.get_or_create(
        email="student@nexai.com",
        defaults={
            "full_name": "Test Student",
            "role": UserRole.STUDENT,
        }
    )
    if created:
        student_user.set_password("password123")
        student_user.save()
        print(f"Created STUDENT user: student@nexai.com / password123")
    
    student_profile, created = Student.objects.get_or_create(
        user=student_user,
        defaults={
            "department": dept,
            "usn": "1XX21CS001",
            "current_semester": 5,
            "batch_year": 2024
        }
    )
    if created:
        print(f"Created Student profile: {student_profile.usn}")

if __name__ == "__main__":
    create_users()
