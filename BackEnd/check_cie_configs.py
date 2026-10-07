import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from cie.models import CIEConfiguration
from scheduling.models import Subject
configs = CIEConfiguration.objects.all()
for c in configs:
    print(c.subject.name, c.cie_number, getattr(c, 'scrutiny', None))

