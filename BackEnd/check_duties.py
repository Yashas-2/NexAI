import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import InvigilationDuty, InvigilatorSessionKey, ExamSession
from django.utils import timezone

now = timezone.now()
print(f'now (aware) = {now}')

duties = InvigilationDuty.objects.select_related('timetable_slot__exam_session', 'timetable_slot__subject', 'invigilator').all()
print(f'Total duties: {duties.count()}')
for d in duties:
    slot = d.timetable_slot
    keys = InvigilatorSessionKey.objects.filter(duty=d)
    key_info = [(k.session_key, k.is_active, k.activated_at) for k in keys]
    print(f'session={slot.exam_session.name} ({slot.exam_session.session_type}) | {slot.subject.code} | {slot.exam_date} {slot.start_time}-{slot.end_time} | {d.invigilator.email} | {d.duty_role} | keys={key_info}')

# timezone settings
from django.conf import settings
print('TIME_ZONE:', settings.TIME_ZONE, '| USE_TZ:', settings.USE_TZ)
