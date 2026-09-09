import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexai_lms.settings')
django.setup()

from scheduling.models import ExamSession
sessions = ExamSession.objects.all()
print("Sessions:", list(sessions.values('id', 'name', 'status')))
