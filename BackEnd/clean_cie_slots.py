import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot, Subject, Room
from datetime import date, time

cie_session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
print(f'CIE Session: {cie_session.name} (ID: {cie_session.id})')

# Get the subjects and rooms
cs301 = Subject.objects.filter(code='CS301').first()
cs302 = Subject.objects.filter(code='CS302').first()
cs303 = Subject.objects.filter(code='CS303').first()
crb1 = Room.objects.filter(name='CRB-1').first()
crb2 = Room.objects.filter(name='CRB-2').first()

# Delete all slots for CIE session
deleted_count, _ = TimetableSlot.objects.filter(exam_session=cie_session).delete()
print(f'Deleted {deleted_count} slots from CIE session')

# Recreate the exact slots the user created (matching SEE session pattern)
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
            exam_session=cie_session,
            subject=sd['subject'],
            exam_date=sd['date'],
            start_time=sd['start'],
            end_time=sd['end'],
            room=sd['room'],
            defaults={'status': 'SCHEDULED'},
        )
        print(f'Slot for {sd["subject"].code} on {sd["date"]} {sd["start"]}-{sd["end"]} in {sd["room"].name}: {"Created" if created else "Exists"}')

print('\nDone creating clean CIE slots')