import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from cie.models import CIEQuestionPaperScrutiny
for s in CIEQuestionPaperScrutiny.objects.all():
    print(s.id, s.paper_title, s.paper_content[:50])

