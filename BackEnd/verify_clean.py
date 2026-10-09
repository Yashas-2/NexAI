import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot

# Delete test sessions
deleted_sessions, _ = ExamSession.objects.filter(name__in=['Test Session', 'Test Session 2']).delete()
print(f'Deleted {deleted_sessions} test sessions')

# Verify clean state
sessions = ExamSession.objects.all()
for s in sessions:
    slots = TimetableSlot.objects.filter(exam_session=s)
    print(f'{s.name} (type: {s.session_type}, status: {s.status}) - {slots.count()} slots')
    for slot in slots:
        room_name = slot.room.name if slot.room else 'No room'
        print(f'  {slot.subject.code} - {slot.exam_date} {slot.start_time}-{slot.end_time} - {room_name}')