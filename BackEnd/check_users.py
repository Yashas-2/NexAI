import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from users.models import User

# Check a few passwords
test_emails = ['cs001@nexai.test', 'cs043@nexai.test', 'cs017@nexai.test']
for email in test_emails:
    try:
        user = User.objects.get(email=email)
        check = user.check_password('Student@123')
        print(email, 'password_ok:', check, 'role:', user.role)
    except User.DoesNotExist:
        print(email, 'NOT FOUND')

# Check how many have usable passwords
all_cs = User.objects.filter(email__startswith='cs')
usable = sum(1 for u in all_cs if u.has_usable_password())
print(f'\nTotal CS users: {all_cs.count()}, usable password: {usable}')

# Check login backend
from django.contrib.auth import authenticate
result = authenticate(username='cs001@nexai.test', password='Student@123')
print(f'authenticate result: {result}')
