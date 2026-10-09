import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.apps import apps
from scheduling.models import TimetableSlot

# The 5 SEE slots created by the earlier cleanup scripts are identifiable by:
#  - session "SEE November 2026", status SCHEDULED
#  - seat_map containing ONLY 4MC23CS001 (assign_see_seats.py fingerprint)
slots = list(
    TimetableSlot.objects.filter(exam_session__session_type='SEE', status='SCHEDULED')
    .select_related('subject', 'room')
)
print(f'Found {len(slots)} SEE SCHEDULED slots')
junk = []
for s in slots:
    keys = set((s.seat_map or {}).keys())
    mine = keys and keys <= {'4MC23CS001'}
    print(f'  {s.exam_date} {s.start_time} {s.subject.code} room={s.room.name if s.room else None} '
          f'usns={sorted(keys)} -> {"SCRIPT JUNK" if mine else "KEEP (not script-created)"}')
    if mine:
        junk.append(s)

if not junk:
    print('Nothing to delete.')
    raise SystemExit(0)

# Check non-CASCADE references from other apps to TimetableSlot
print()
print('FK references to scheduling.TimetableSlot:')
for model in apps.get_models():
    for f in model._meta.fields:
        if f.is_relation and getattr(f.related_model, '_meta', None) and f.related_model._meta.label == 'scheduling.TimetableSlot':
            from django.db.models import CASCADE
            on_del = getattr(f.remote_field, 'on_delete', None)
            print(f'  {model._meta.label}.{f.name} on_delete={getattr(on_del, "__name__", on_del)}')

junk_ids = [s.id for s in junk]
blocked = False
for model in apps.get_models():
    for f in model._meta.fields:
        if (f.is_relation and getattr(f.related_model, '_meta', None)
                and f.related_model._meta.label == 'scheduling.TimetableSlot'):
            from django.db.models import CASCADE
            if getattr(f.remote_field, 'on_delete', None) is not CASCADE:
                n = model._meta.default_manager.filter(**{f.name + '__in': junk_ids}).count()
                if n:
                    print(f'BLOCKED: {n} rows in {model._meta.label} reference junk slots via {f.name}')
                    blocked = True

if blocked:
    print('Not deleting — resolve references first.')
    raise SystemExit(1)

n = len(junk)
deleted, errs = TimetableSlot.objects.filter(id__in=[s.id for s in junk]).delete()
print(f'Deleted: total objects={deleted}')
print(f'Done ({n} slots removed).')
