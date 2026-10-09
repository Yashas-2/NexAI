import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import TimetableSlot, ExamSession

session = ExamSession.objects.filter(name__icontains='CIE-1 Series').first()
slots = TimetableSlot.objects.filter(exam_session=session).select_related('subject', 'room')
for s in slots:
    print(f'{s.subject.code} - {s.exam_date} {s.start_time}-{s.end_time} - {s.room.name if s.room else "No room"} - seat_map: {s.seat_map}')