import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from users.models import User
from eligibility.models import HallTicket
from cie.models import CIEConfiguration
from vault.models import QuestionPaper

user = User.objects.filter(role='STUDENT').first()
ht = HallTicket.objects.filter(student=user.student_profile).first()

if ht:
    print(f'Hall Ticket Session: {ht.exam_session.name}')
    print(f'Session ID: {ht.exam_session.id}')
    
    cie_configs = CIEConfiguration.objects.filter(
        exam_session=ht.exam_session,
        is_active=True,
    ).select_related('scrutiny')
    
    print(f'Found {cie_configs.count()} CIE Configs active for this session')
    for c in cie_configs:
        print(f'  {c.subject.code} CIE Config ID: {c.id}')
        try:
            print(f'    Scrutiny ID: {c.scrutiny.id}, Status: {c.scrutiny.status}')
        except Exception as e:
            print(f'    Scrutiny Error: {e}')
            
    print(f'All CIE configs in DB:')
    for c in CIEConfiguration.objects.all():
        print(f'  {c.subject.code} (Session {c.exam_session.name}) - Active: {c.is_active}')
