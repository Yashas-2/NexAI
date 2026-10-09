import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import InvigilationDuty, TimetableSlot
from users.models import User

ACTIVE = ['SCHEDULED', 'CONFIRMED']

# Same-branch faculty in id order (matches the HOD modal rotation)
cs_faculty = list(User.objects.filter(role='FACULTY', department__code='CS').order_by('id'))
print('CS faculty pool:', [u.email for u in cs_faculty])

rot = {}
fixed = 0
for d in InvigilationDuty.objects.select_related(
    'invigilator', 'timetable_slot', 'timetable_slot__subject', 'timetable_slot__subject__department'
).filter(timetable_slot__status__in=ACTIVE).order_by('timetable_slot__exam_date', 'timetable_slot__start_time'):
    inv = d.invigilator
    subj = d.timetable_slot.subject
    wrong = inv.role != 'FACULTY' or (
        subj.department_id and inv.department_id and inv.department_id != subj.department_id
    )
    if not wrong:
        continue

    pool = list(User.objects.filter(role='FACULTY', department_id=subj.department_id).order_by('id'))
    if not pool:
        pool = list(User.objects.filter(role='FACULTY').order_by('id'))
    if not pool:
        print(f'NO FACULTY available for {subj.code} - leaving {inv.email} in place')
        continue

    key = subj.department_id
    idx = rot.get(key, 0)
    rot[key] = idx + 1
    new_inv = pool[idx % len(pool)]

    old_email = inv.email
    d.invigilator = new_inv
    d.save(update_fields=['invigilator'])
    fixed += 1
    print(f'FIXED {subj.code} ({d.timetable_slot.exam_date} {d.timetable_slot.start_time}): '
          f'{old_email} -> {new_inv.email}')

print(f'Total fixed: {fixed}')
