import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession
from eligibility.tasks import generate_hall_tickets_for_session

for session in ExamSession.objects.filter(status='SCHEDULED'):
    print(f"Generating for {session.name} ({session.id})...")
    generate_hall_tickets_for_session(str(session.id))
    print("Done.")
