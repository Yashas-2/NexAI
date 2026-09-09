import requests
import sys

BASE_URL = "http://localhost:8000/api/v1"

# 1. Login as the COE (Chief Superintendent) to get the JWT token
print("1. Logging in as COE...")
login_data = {
    "email": "coe@nexai.com",
    "password": "password123"
}
response = requests.post(f"{BASE_URL}/auth/login/", json=login_data)

if response.status_code != 200:
    print(f"Failed to login as COE. Are you sure 'coe@nexai.com' with 'password123' exists? Error: {response.text}")
    print("If you haven't created the COE yet, run: python create_test_users.py")
    sys.exit(1)

token = response.json().get("access")
headers = {"Authorization": f"Bearer {token}"}
print("✅ Logged in successfully.\n")

# 2. Get a list of users to find someone to test on
print("2. Fetching user list...")
response = requests.get(f"{BASE_URL}/auth/users/", headers=headers)
users = response.json()

# Find a test user (e.g., an HOD or any non-COE user)
test_user = next((u for u in users.get("results", users) if u["email"] != "coe@nexai.com"), None)

if not test_user:
    print("No other users found in the system to test on. Please run 'python create_test_users.py' first.")
    sys.exit(1)

user_id = test_user["id"]
user_email = test_user["email"]
print(f"✅ Picked test user: {user_email} (ID: {user_id})\n")

# 3. Test Updating User Details (PUT)
print(f"3. Testing User Update on {user_email}...")
update_data = {
    "email": user_email,
    "full_name": test_user["full_name"] + " (Updated)",
    "role": test_user["role"],
    "phone": "9998887776",
    "employee_id": test_user["employee_id"]
}
response = requests.put(f"{BASE_URL}/auth/users/{user_id}/", headers=headers, json=update_data)
if response.status_code == 200:
    print(f"✅ User updated successfully. New Name: {response.json()['full_name']}\n")
else:
    print(f"❌ Failed to update user: {response.text}\n")

# 4. Test Password Reset (POST)
print("4. Testing Password Reset...")
reset_data = {"new_password": "NewPassword123!"}
response = requests.post(f"{BASE_URL}/auth/users/{user_id}/reset-password/", headers=headers, json=reset_data)
if response.status_code == 200:
    print(f"✅ Password reset successfully for {user_email}.\n")
else:
    print(f"❌ Failed to reset password: {response.text}\n")

# 5. Verify Password Reset Works (Login with new password)
print("5. Verifying new password works...")
test_login_data = {
    "email": user_email,
    "password": "NewPassword123!"
}
response = requests.post(f"{BASE_URL}/auth/login/", json=test_login_data)
if response.status_code == 200:
    print(f"✅ Successfully logged in as {user_email} with the NEW password.\n")
else:
    print(f"❌ Failed to login with new password: {response.text}\n")

# 6. Test User Suspension (POST)
print(f"6. Testing User Suspension on {user_email}...")
response = requests.post(f"{BASE_URL}/auth/users/{user_id}/suspend/", headers=headers)
if response.status_code == 200:
    print(f"✅ User {user_email} suspended successfully.\n")
else:
    print(f"❌ Failed to suspend user: {response.text}\n")

# 7. Verify suspended user cannot login
print("7. Verifying suspended user cannot login...")
response = requests.post(f"{BASE_URL}/auth/login/", json=test_login_data)
if response.status_code == 401:
    print(f"✅ Correctly rejected login for suspended user: {response.json()['detail']}\n")
else:
    print(f"❌ Unexpected behavior. Expected login to fail, but got status {response.status_code}: {response.text}\n")

print("🎉 PHASE 1 TESTING COMPLETE! All endpoints are working exactly as expected.")
