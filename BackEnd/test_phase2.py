import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User, Student, Department
from scheduling.models import Subject, ExamSession

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_phase2():
    print("Testing Phase 2: Curriculum (Subjects, Enrollments)\n")
    
    # 1. Login as COE to setup data
    print("1. Logging in as COE to setup data...")
    response = requests.post(f"{BASE_URL}/auth/login/", json={
        "email": "coe@nexai.com",
        "password": "password123"
    })
    
    if response.status_code != 200:
        print(f"❌ COE Login failed: {response.text}")
        return
        
    coe_token = response.json().get('access')
    coe_headers = {"Authorization": f"Bearer {coe_token}"}
    print("✅ Logged in successfully.\n")
    
    # 2. Get a student
    student = Student.objects.first()
    if not student:
        print("❌ No students found. Please run create_test_users.py")
        return
        
    print(f"✅ Picked test student: {student.user.email} (USN: {student.usn})")
    
    # 3. Get or create Exam Session
    session = ExamSession.objects.first()
    if not session:
        session = ExamSession.objects.create(
            name="Fall 2026 Midterms",
            semester=5,
            academic_year="2026",
            start_date="2026-10-01",
            end_date="2026-10-15"
        )
    
    # 4. Get a subject
    subject = Subject.objects.first()
    if not subject:
        subject = Subject.objects.create(
            code="CS501",
            name="Advanced Database Systems",
            department=student.department,
            semester=5,
            batch_year=2024
        )
    print(f"✅ Using Subject: {subject.code} - {subject.name}")
    print(f"✅ Using Exam Session: {session.name}\n")
    
    # 5. Enroll Student via API
    print(f"2. Enrolling student {student.usn} into {subject.code}...")
    enroll_resp = requests.post(
        f"{BASE_URL}/scheduling/subjects/{subject.id}/enroll/",
        headers=coe_headers,
        json={
            "student": str(student.id),
            "exam_session": str(session.id)
        }
    )
    
    if enroll_resp.status_code == 201:
        print("✅ Student enrolled successfully.")
    elif enroll_resp.status_code == 400 and "non_field_errors" in enroll_resp.json():
        print("✅ Student is already enrolled (expected if run multiple times).")
    else:
        print(f"❌ Failed to enroll student: {enroll_resp.status_code} - {enroll_resp.text}")
        return
        
    # 6. Verify enrolled students list for subject
    print("\n3. Fetching enrolled students for subject...")
    students_resp = requests.get(
        f"{BASE_URL}/scheduling/subjects/{subject.id}/enrolled-students/",
        headers=coe_headers
    )
    
    if students_resp.status_code == 200:
        data = students_resp.json()
        results = data.get("results", data)
        print(f"✅ Subject has {len(results)} enrolled students.")
        if any(s["student_usn"] == student.usn for s in results):
            print("✅ Test student is correctly listed in the subject's enrollment list.")
        else:
            print("❌ Test student is MISSING from the enrollment list.")
            return
    else:
        print(f"❌ Failed to fetch enrolled students: {students_resp.status_code} - {students_resp.text}")
        return
        
    # 7. Student Login & Verify Portal Enrollments
    print(f"\n4. Logging in as Student ({student.user.email})...")
    
    # Reset student password just in case
    student.user.set_password('password123')
    student.user.save()
    
    student_login = requests.post(f"{BASE_URL}/auth/login/", json={
        "email": student.user.email,
        "password": "password123"
    })
    
    if student_login.status_code != 200:
        print(f"❌ Student Login failed: {student_login.text}")
        return
        
    student_token = student_login.json().get('access')
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("✅ Student logged in successfully.\n")
    
    print("5. Fetching Student Portal Enrollments...")
    my_enrollments_resp = requests.get(
        f"{BASE_URL}/student/portal/my_enrollments/",
        headers=student_headers
    )
    
    if my_enrollments_resp.status_code == 200:
        enrolls = my_enrollments_resp.json()
        print(f"✅ Student has {len(enrolls)} enrollments listed.")
        if any(e["subject_code"] == subject.code for e in enrolls):
            print("✅ Subject correctly appears in the student's personal portal!")
        else:
            print("❌ Subject MISSING from student's personal portal.")
            return
    else:
        print(f"❌ Failed to fetch student enrollments: {my_enrollments_resp.status_code} - {my_enrollments_resp.text}")
        return

    print("\n🎉 PHASE 2 TESTING COMPLETE! All endpoints are working exactly as expected.")

if __name__ == "__main__":
    test_phase2()
