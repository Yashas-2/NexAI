import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot
from django.db.models import Count

see_session = ExamSession.objects.filter(name__icontains='SEE November').first()
slots = TimetableSlot.objects.filter(exam_session=see_session)

# Find duplicate groups
duplicates = TimetableSlot.objects.filter(exam_session=see_session).values(
    'subject', 'exam_date', 'start_time', 'end_time', 'room'
).annotate(count=Count('id')).filter(count__gt=1)

print('Duplicate groups:')
for d in duplicates:
    print(f'  Subject: {d["subject"]}, Date: {d["exam_date"]}, Time: {d["start_time"]}-{d["end_time"]}, Room: {d["room"]}, Count: {d["count"]}')