import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from cie.models import CIEQuestionPaperScrutiny
for paper in CIEQuestionPaperScrutiny.objects.all():
    print(f"Exam: {paper.cie_config.subject.name} (Status: {paper.status})")
    print(paper.paper_content)
    print("-" * 40)
