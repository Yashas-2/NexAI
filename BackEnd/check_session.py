import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot, Subject, StudentSubjectEnrollment
from eligibility.models import StudentEligibility, HallTicket

# Get the CIE session
session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
print(f'Session: {session.name} (ID: {session.id}, type: {session.session_type})')

# Check slots
slots = TimetableSlot.objects.filter(exam_session=session)
print(f'TimetableSlots: {slots.count()}')
for s in slots:
    print(f'  {s.subject.code} - {s.exam_date} {s.start_time}-{s.end_time} - {s.room.name if s.room else "No room"}')

# Check enrollments
enrollments = StudentSubjectEnrollment.objects.filter(exam_session=session)
print(f'Enrollments: {enrollments.count()}')

# Check eligibility
elig = StudentEligibility.objects.filter(exam_session=session)
print(f'Eligibility records: {elig.count()}')

# Check hall tickets
tickets = HallTicket.objects.filter(exam_session=session)
print(f'Hall Tickets: {tickets.count()}')