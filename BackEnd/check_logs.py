import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import TimetableRescheduleLog, TimetableSlot, ExamSession
from django.db.models import Max

see = ExamSession.objects.filter(name__icontains='SEE November').first()
logs = TimetableRescheduleLog.objects.filter(exam_session=see).order_by('-created_at')
print(f'Total logs: {logs.count()}')

# Group by subject+room, show latest entries
seen = set()
for l in logs:
    key = (l.subject_code, l.room_name)
    if key in seen:
        continue
    seen.add(key)
    print(f'{l.subject_code} | {l.room_name} | {l.exam_date} {l.start_time}-{l.end_time} | reason={l.reason} | changed_by={l.changed_by} | at={l.created_at}')

print('\n--- All logs matching blueprint signature (02:05 or 10/9,10/13,10/15) ---')
for l in logs:
    d = str(l.exam_date)
    if d in ('2026-10-09', '2026-10-13', '2026-10-15') or str(l.start_time).startswith('02:05'):
        print(f'{l.subject_code} | {l.room_name} | {l.exam_date} {l.start_time}-{l.end_time} | reason={l.reason} | at={l.created_at}')

print('\n--- Current slots ---')
for s in TimetableSlot.objects.filter(exam_session=see):
    print(f'{s.subject.code} | {s.room.name} | {s.exam_date} {s.start_time}-{s.end_time} | status={s.status}')

print('\n--- InvigilationDuty count on current slots ---')
from scheduling.models import InvigilationDuty
print(InvigilationDuty.objects.filter(timetable_slot__exam_session=see).count())
