import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from student.views import StudentProfileView
from rest_framework.test import APIRequestFactory
from users.models import User
user = User.objects.get(email='cs001@nexai.test')
factory = APIRequestFactory()
request = factory.get('/api/v1/student/portal/my_profile/')
request.user = user
view = StudentProfileView.as_view()
response = view(request)
print(response.data)

