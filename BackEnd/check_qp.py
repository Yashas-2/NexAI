import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from vault.models import QuestionPaper, Question
for p in QuestionPaper.objects.all():
    print(p.id, p.subject.name, p.exam_session.name)
    for q in p.questions.all():
        print('  ', q.question_number, q.text_content[:30])

