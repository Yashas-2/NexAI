import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from scheduling.models import ExamSession, StudentSubjectEnrollment

session = ExamSession.objects.first()
print('Session:', session.name, '| ID:', str(session.id)[:8])
print('Subjects:', list(session.subjects.values_list('code', flat=True)))

for code in ['CS301','CS302','CS303']:
    qs = StudentSubjectEnrollment.objects.filter(subject__code=code)
    linked = qs.filter(exam_session=session).count()
    print(code, 'total:', qs.count(), 'linked_to_session:', linked)

# Check total across all subjects
all_linked = StudentSubjectEnrollment.objects.filter(exam_session=session).count()
print('All linked to session:', all_linked)
