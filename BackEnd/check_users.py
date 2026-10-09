import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from users.models import User
from scheduling.models import Subject

for u in User.objects.all().order_by('email'):
    dept = getattr(u, 'department', None)
    print(f'{u.email} | role={u.role} | dept={dept.code if dept else None} | name={u.full_name}')

print()
for s in Subject.objects.all():
    print(f'{s.code} | dept={s.department.code if s.department else None}')
