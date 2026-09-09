import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from users.models import User
from django.contrib.auth import authenticate

# 1. Check user exists
user = User.objects.filter(email='cs001@nexai.test').first()
if not user:
    print("ERROR: User not found")
    exit(1)

print("=== USER RECORD ===")
print("ID:", user.id)
print("Email:", user.email)
print("Full name:", user.full_name)
print("Role:", user.role)
print("Department:", user.department)
print("is_active:", user.is_active)
print("has_usable_password:", user.has_usable_password())
print("Password hash starts with:", user.password[:20])

# 2. Check password
print("\n=== PASSWORD CHECK ===")
print("check_password('Student@123'):", user.check_password('Student@123'))

# 3. Check authenticate()
print("\n=== DJANGO AUTHENTICATE ===")
result = authenticate(username='cs001@nexai.test', password='Student@123')
print("authenticate result:", result)

# 4. Check the USERNAME_FIELD
print("\n=== AUTH CONFIG ===")
print("USERNAME_FIELD:", User.USERNAME_FIELD)
print("REQUIRED_FIELDS:", User.REQUIRED_FIELDS)

# 5. Check what the login serializer expects
from users.serializers import NexAITokenObtainPairSerializer
print("\n=== TOKEN SERIALIZER ===")
print("Serializer fields:", NexAITokenObtainPairSerializer().fields.keys() if hasattr(NexAITokenObtainPairSerializer(), 'fields') else 'N/A')
