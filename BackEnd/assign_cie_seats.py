import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import TimetableSlot, ExamSession, StudentSubjectEnrollment
from users.models import Student

session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
student = Student.objects.get(usn='4MC23CS001')

# Get subjects the student is enrolled in for this session
enrollments = StudentSubjectEnrollment.objects.filter(student=student, exam_session=session)
enrolled_subject_ids = set(e.subject_id for e in enrollments)

# Get all slots for this session where the student's subject matches
slots = TimetableSlot.objects.filter(exam_session=session, subject_id__in=enrolled_subject_ids)

print(f'Slots for enrolled subjects:')
for s in slots:
    has_seat = student.usn in (s.seat_map or {})
    print(f'  {s.subject.code} - {s.exam_date} {s.start_time}-{s.end_time} - {s.room.name if s.room else "No room"} - Has seat: {has_seat}')

# Add seat for student in all slots where they don't have one
for s in slots:
    if student.usn not in (s.seat_map or {}):
        existing_seats = list((s.seat_map or {}).values())
        row = len(existing_seats) // 6 + 1
        seat = len(existing_seats) % 6 + 1
        seat_id = f'R{row}-S{seat}'
        
        if s.seat_map is None:
            s.seat_map = {}
        s.seat_map[student.usn] = seat_id
        s.save(update_fields=['seat_map'])
        print(f'Added seat {seat_id} for {student.usn} in {s.subject.code} on {s.exam_date} {s.start_time}-{s.end_time} in {s.room.name}')
    else:
        print(f'Seat already exists for {student.usn} in {s.subject.code} on {s.exam_date} {s.start_time}-{s.end_time}')

print('\nDone assigning seats')