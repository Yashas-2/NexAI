import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot

see_session = ExamSession.objects.filter(name__icontains='SEE November').first()
slots = TimetableSlot.objects.filter(exam_session=see_session).select_related('subject', 'room')

print(f'Total slots in {see_session.name}: {slots.count()}')
for s in slots:
    print(f'  {s.subject.code} - {s.exam_date} {s.start_time}-{s.end_time} - {s.room.name if s.room else "No room"}')