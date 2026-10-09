import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from eligibility.models import HallTicket
from django.db.models import Count

print('=== Hall tickets per session ===')
for row in HallTicket.objects.values('exam_session__name').annotate(n=Count('id')):
    print(row)

print()
print('=== SEE SCHEDULED slots (all) ===')
from scheduling.models import TimetableSlot
for s in TimetableSlot.objects.filter(exam_session__session_type='SEE', status='SCHEDULED').select_related('subject', 'room'):
    sm = s.seat_map or {}
    print(f'{s.exam_date} {s.start_time}-{s.end_time} {s.subject.code} room={s.room.name if s.room else None} '
          f'seats={len(sm)} usns={list(sm)[:5]}')
