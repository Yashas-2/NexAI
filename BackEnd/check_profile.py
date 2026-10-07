import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from users.models import User, Student
student = Student.objects.get(user__email='cs001@nexai.test')
print('USN:', student.usn)

