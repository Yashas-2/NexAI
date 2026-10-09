import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot, Subject, Room

see_session = ExamSession.objects.filter(name__icontains='SEE November').first()
print(f'Session: {see_session.name} (ID: {see_session.id})')

# Get the subjects and rooms the user actually created
cs301 = Subject.objects.filter(code='CS301').first()
cs302 = Subject.objects.filter(code='CS302').first()
cs303 = Subject.objects.filter(code='CS303').first()
crb1 = Room.objects.filter(name='CRB-1').first()
crb2 = Room.objects.filter(name='CRB-2').first()

print(f'CS301: {cs301}')
print(f'CS302: {cs302}')
print(f'CS303: {cs303}')
print(f'CRB-1: {crb1}')
print(f'CRB-2: {crb2}')

# Delete all slots for this session
from scheduling.models import TimetableSlot
deleted_count, _ = TimetableSlot.objects.filter(exam_session=see_session).delete()
print(f'\nDeleted {deleted_count} slots')

# Recreate the exact slots the user created
from datetime import date, time

slots_data = [
    # Day 1 - 2026-10-09
    {'subject': cs301, 'room': crb1, 'date': date(2026,10,9), 'start': time(9,0), 'end': time(12,0)},
    {'subject': cs302, 'room': crb1, 'date': date(2026,10,9), 'start': time(14,0), 'end': time(17,0)},
    {'subject': cs303, 'room': crb2, 'date': date(2026,10,9), 'start': time(9,0), 'end': time(12,0)},
    # Day 2 - 2026-10-10
    {'subject': cs302, 'room': crb2, 'date': date(2026,10,10), 'start': time(9,0), 'end': time(12,0)},
    {'subject': cs303, 'room': crb1, 'date': date(2026,10,10), 'start': time(14,0), 'end': time(17,0)},
]

for sd in slots_data:
    if sd['subject'] and sd['room']:
        slot, created = TimetableSlot.objects.get_or_create(
            exam_session=see_session,
            subject=sd['subject'],
            exam_date=sd['date'],
            start_time=sd['start'],
            end_time=sd['end'],
            room=sd['room'],
            defaults={
                'status': 'SCHEDULED',
            }
        )
        print(f'Slot for {sd["subject"].code} on {sd["date"]} {sd["start"]}-{sd["end"]} in {sd["room"].name}: {"Created" if created else "Exists"}')

print('\nDone creating clean slots')