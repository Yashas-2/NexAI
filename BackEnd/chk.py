import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()
from scheduling.models import ExamSession

s = ExamSession.objects.get(id='c53cc160-f460-4b8d-adfe-2f7fc7f1e5ce')
print(f"Status: {s.status}")
