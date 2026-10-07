import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from vault.models import QuestionPaper
from cie.models import CIEQuestionPaperScrutiny

print("QuestionPapers:")
for p in QuestionPaper.objects.all():
    print(f" - {p.id} | Subj: {p.subject.code} | Session: {p.exam_session.name} | Status: {p.status}")

print("\nCIEQuestionPaperScrutiny:")
for s in CIEQuestionPaperScrutiny.objects.all():
    print(f" - {s.id} | Config: {s.cie_config.id} | Status: {s.status}")
