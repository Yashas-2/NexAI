import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import StudentSubjectEnrollment
from users.models import Student

print('total students:', Student.objects.count())
for code in ['CS301', 'CS302', 'CS303', 'MECH701', 'MECH702', 'MECH703']:
    rows = StudentSubjectEnrollment.objects.filter(subject__code=code)
    for r in rows:
        pass
    by_sess = {}
    for r in rows.select_related('exam_session'):
        by_sess.setdefault(r.exam_session.name, []).append(r.student.usn)
    for sess, usns in by_sess.items():
        print(f'{code} session="{sess}": {len(usns)} enrolled')
