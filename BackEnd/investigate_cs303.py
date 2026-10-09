import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import TimetableSlot, ExamSession, StudentSubjectEnrollment, InvigilationDuty
from eligibility.models import HallTicket, StudentEligibility
from users.models import User, Student

print('=== Active slots for CS303 ===')
for s in TimetableSlot.objects.filter(subject__code='CS303').select_related('exam_session', 'room').order_by('exam_date', 'start_time'):
    seat = 'HAS_SEAT' if s.seat_map else 'no_seat'
    print(f'{s.status:12} {s.exam_date} {s.start_time}-{s.end_time} room={s.room.name if s.room else None} '
          f'session="{s.exam_session.name}" ({s.exam_session.session_type}) {seat} seats={len(s.seat_map or {})}')

print()
print('=== Active slots on 2026-10-10 ===')
for s in TimetableSlot.objects.filter(exam_date='2026-10-10').select_related('exam_session', 'subject', 'room').order_by('start_time'):
    print(f'{s.status:12} {s.subject.code} {s.start_time}-{s.end_time} room={s.room.name if s.room else None} '
          f'session="{s.exam_session.name}" seats={len(s.seat_map or {})}')

print()
print('=== Exam sessions ===')
for e in ExamSession.objects.all().order_by('created_at'):
    print(f'"{e.name}" type={e.session_type} {e.start_date}..{e.end_date} status={e.status} '
          f'created_by={e.created_by.email if e.created_by else None} created={e.created_at}')

print()
print('=== cs001 student ===')
u = User.objects.filter(email='cs001@nexai.test').first()
st = Student.objects.filter(user=u).first()
print(f'user={u} role={u.role} dept={u.department} student={st} usn={st.usn if st else None}')

print()
print('=== cs001 enrollments ===')
for e in StudentSubjectEnrollment.objects.filter(student=st).select_related('subject', 'exam_session'):
    print(f'{e.subject.code} session="{e.exam_session.name}"')

print()
print('=== cs001 hall tickets ===')
for t in HallTicket.objects.filter(student=st).select_related('exam_session'):
    print(f'session="{t.exam_session.name}" status={getattr(t, "status", None)} revoked={t.is_revoked} qr={t.qr_code_data}')

print()
print('=== cs001 eligibility ===')
for el in StudentEligibility.objects.filter(student=st).select_related('subject', 'exam_session'):
    print(f'{el.subject.code} session="{el.exam_session.name}" eligible={el.is_eligible} updated={el.updated_at}')

print()
print('=== cs001 seat in CS303 slots ===')
for s in TimetableSlot.objects.filter(subject__code='CS303', status='SCHEDULED'):
    sm = s.seat_map or {}
    hit = [k for k in sm if k == (st.usn if st else '')]
    print(f'{s.exam_date} {s.start_time} seat_for_usn={hit} total_seats={len(sm)}')
