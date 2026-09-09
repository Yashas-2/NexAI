import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexai_backend.settings')
django.setup()

from users.models import User, Department, Student
import csv
import io

csv_content = """USN,Student_Name,Email,Semester,Department
4MC23CS001,Aarav,student01@nexai.com,3rd Sem,Computer Science & Engineering
"""

reader = csv.DictReader(io.StringIO(csv_content))
errors = []
for row_num, row in enumerate(reader, start=1):
    try:
        usn = row.get("USN").strip()
        name = row.get("Student_Name").strip()
        email = row.get("Email").strip().lower()
        semester = row.get("Semester").strip()
        dept_name = row.get("Department").strip()
        
        dept = Department.objects.filter(name__icontains=dept_name).first()
        if not dept:
            dept = Department.objects.first() # fallback for test
            
        user, u_created = User.objects.get_or_create(
            email=email,
            defaults={"full_name": name, "role": "STUDENT", "department": dept, "plain_password": "password123"}
        )
        print("User:", user, u_created)
        
        semester_num = 1
        if semester:
            digits = "".join(filter(str.isdigit, semester))
            if digits:
                semester_num = int(digits)
                
        student, _ = Student.objects.get_or_create(
            user=user,
            defaults={"usn": usn, "department": dept, "current_semester": semester_num, "batch_year": 2026}
        )
        print("Student:", student)
    except Exception as e:
        print("Error on row", row_num, ":", repr(e))
