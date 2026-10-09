import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import InvigilationDuty, TimetableSlot

ACTIVE = ['SCHEDULED', 'CONFIRMED']
rows = (
    InvigilationDuty.objects.select_related('invigilator', 'invigilator__department',
                                            'timetable_slot', 'timetable_slot__subject',
                                            'timetable_slot__subject__department',
                                            'timetable_slot__exam_session')
    .order_by('timetable_slot__exam_date', 'timetable_slot__start_time')
)
for d in rows:
    slot = d.timetable_slot
    subj = slot.subject
    inv = d.invigilator
    sdept = subj.department.code if subj.department else None
    idept = inv.department.code if inv.department else None
    problems = []
    if inv.role != 'FACULTY':
        problems.append(f'role={inv.role}')
    elif sdept and idept and sdept != idept:
        problems.append(f'cross-branch {idept}->{sdept}')
    flag = '  <-- WRONG: ' + ', '.join(problems) if problems else ''
    print(f'slot={slot.status:10} {slot.exam_date} {slot.start_time}-{slot.end_time} '
          f'{subj.code}(dept={sdept}) | {d.duty_role:7} | {inv.email} role={inv.role} dept={idept}{flag}')
