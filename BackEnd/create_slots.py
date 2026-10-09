import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from datetime import date, time
from scheduling.models import ExamSession, TimetableSlot, Subject, Room

# Get the session
session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
print(f'Session: {session.name} (type: {session.session_type})')

# Get subjects
cs301 = Subject.objects.filter(code='CS301').first()
cs302 = Subject.objects.filter(code='CS302').first()
cs303 = Subject.objects.filter(code='CS303').first()

# Get rooms
crb1 = Room.objects.filter(name='CRB-1').first()
crb2 = Room.objects.filter(name='CRB-2').first()

print(f'CS301: {cs301}, CS302: {cs302}, CS303: {cs303}')
print(f'CRB-1: {crb1}, CRB-2: {crb2}')

# Create TimetableSlots for 2026-10-09 and 2026-10-10
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
            exam_session=session,
            subject=sd['subject'],
            exam_date=sd['date'],
            start_time=sd['start'],
            end_time=sd['end'],
            room=sd['room'],
            defaults={
                'status': 'SCHEDULED',
                'exam_session': session,
            }
        )
        print(f'Slot for {sd["subject"].code} on {sd["date"]} {sd["start"]}-{sd["end"]} in {sd["room"].name}: {"Created" if created else "Exists"}')

print('Done creating slots')