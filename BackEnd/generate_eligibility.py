import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, StudentSubjectEnrollment, Subject
from eligibility.models import StudentEligibility
from users.models import Student
from decimal import Decimal

# Get the CIE session
session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
print(f'Session: {session.name} (ID: {session.id}, type: {session.session_type})')

# Get enrolled students
enrolled_ids = set(
    StudentSubjectEnrollment.objects.filter(
        exam_session=session
    ).values_list('student_id', flat=True)
)

print(f'Enrolled student IDs: {len(enrolled_ids)}')

# Check if eligibility already exists for some
existing_elig = StudentEligibility.objects.filter(
    student_id__in=enrolled_ids, 
    exam_session=session
).values('student_id', 'subject_id')
existing_keys = set((e['student_id'], e['subject_id']) for e in existing_elig)
print(f'Existing eligibility records: {len(existing_keys)}')

# Get enrollments with subject info
enrollments = StudentSubjectEnrollment.objects.filter(
    exam_session=session
).select_related('student', 'subject')

created_count = 0
for enrollment in enrollments:
    student_id = enrollment.student_id
    subject_id = enrollment.subject_id
    
    key = (student_id, subject_id)
    if key in existing_keys:
        continue  # Already exists
    
    # Create eligibility with default values (assuming good attendance and passing CIE marks)
    StudentEligibility.objects.create(
        student_id=student_id,
        subject_id=subject_id,
        exam_session=session,
        attendance_percentage=Decimal('90.00'),  # Default good attendance
        cie1_marks=Decimal('18.00'),
        cie2_marks=Decimal('18.00'),
        cie3_marks=Decimal('18.00'),
        assignment_marks=Decimal('18.00'),
        cie_marks=Decimal('72.00'),
        is_eligible=True,
        remarks='Auto-generated for new session',
    )
    created_count += 1

print(f'Created {created_count} eligibility records')