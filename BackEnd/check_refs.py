import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, TimetableSlot

sessions = ExamSession.objects.all()
for s in sessions:
    print(f'=== {s.name} ({s.session_type}, {s.status}) created_by={s.created_by} created_at={s.created_at} ===')
    slots = TimetableSlot.objects.filter(exam_session=s)
    for sl in slots:
        print(f'  slot {sl.id} | {sl.subject.code} | {sl.exam_date} {sl.start_time}-{sl.end_time} | {sl.room.name} | created_at={sl.created_at}')

slot_ids = list(TimetableSlot.objects.values_list('id', flat=True))

# Check PROTECT-able references
from django.apps import apps
print('\n=== References to these slots ===')
for model in apps.get_models():
    for f in model._meta.fields:
        if f.is_relation and getattr(f.related_model, '__name__', None) == 'TimetableSlot':
            try:
                count = model.objects.filter(**{f.name + '__in': slot_ids}).count()
            except Exception as e:
                count = f'error: {e}'
            if count:
                print(f'  {model._meta.label}: {count} rows (on_delete={f.remote_field.on_delete.__name__})')

# Check references to sessions
session_ids = list(sessions.values_list('id', flat=True))
print('\n=== References to these sessions ===')
for model in apps.get_models():
    for f in model._meta.fields:
        if f.is_relation and getattr(f.related_model, '__name__', None) == 'ExamSession':
            try:
                count = model.objects.filter(**{f.name + '__in': session_ids}).count()
            except Exception as e:
                count = f'error: {e}'
            if count:
                print(f'  {model._meta.label}: {count} rows (on_delete={f.remote_field.on_delete.__name__})')
