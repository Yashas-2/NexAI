import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from users.models import Student
from eligibility.models import HallTicket, StudentEligibility
student = Student.objects.get(user__email='cs001@nexai.test')
tickets = HallTicket.objects.filter(student=student)
for t in tickets:
    print(t.exam_session.name)
from eligibility.serializers import HallTicketSerializer
if tickets.exists():
    print(HallTicketSerializer(tickets, many=True).data)
else:
    print('No hall tickets found!')

