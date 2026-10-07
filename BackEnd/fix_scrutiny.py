import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
from users.models import User
config = CIEConfiguration.objects.filter(subject__name='Deep Learning', cie_number='CIE_1').first()
if config:
    if not hasattr(config, 'scrutiny'):
        scrutiny = CIEQuestionPaperScrutiny.objects.create(
            cie_config=config,
            paper_title='Deep Learning CIE 1',
            paper_content='1. What is Deep Learning?\n2. Explain Backpropagation.\n3. What are CNNs?',
            answer_key='Model answers...',
            status='APPROVED',
            submitted_by=User.objects.filter(role='FACULTY').first(),
            reviewed_by=User.objects.filter(role='HOD').first(),
        )
        print('Created scrutiny:', scrutiny.id)
    else:
        config.scrutiny.status = 'APPROVED'
        config.scrutiny.save()
        print('Updated scrutiny to APPROVED:', config.scrutiny.id)
else:
    print('Deep Learning config not found')

