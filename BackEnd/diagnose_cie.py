import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny

print("=== CIEConfiguration Records ===")
for c in CIEConfiguration.objects.select_related('subject'):
    print(f"  ID={c.id} | {c.subject.code} {c.cie_number}")

print("\n=== CIEQuestionPaperScrutiny Records ===")
for s in CIEQuestionPaperScrutiny.objects.select_related('cie_config__subject'):
    print(f"  ID={s.id} | cie_config_id={s.cie_config_id} | subject={s.cie_config.subject.code if s.cie_config else 'None'} | status={s.status}")
