import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from users.models import User
from eligibility.serializers import HallTicketSerializer
from eligibility.models import HallTicket

user = User.objects.filter(role='STUDENT').first()
ht = HallTicket.objects.filter(student=user.student_profile).first()

if ht:
    serializer = HallTicketSerializer(ht)
    data = serializer.data
    slots = data.get('slots', [])
    print(f'Hall Ticket for {user.email}:')
    for slot in slots:
        print(f"  Subject: {slot.get('subject_code')} - {slot.get('subject_title')}")
        print(f"  Question Paper ID: {slot.get('question_paper_id')}")
        print(f"  Date: {slot.get('exam_date')}")
else:
    print('No hall ticket found.')
