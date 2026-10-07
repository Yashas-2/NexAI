import json
import urllib.request
from datetime import timedelta

# This is a placeholder for the script that will generate the solver.py
# I will write the actual code in the next step after verifying the API
try:
    req = urllib.request.Request("https://date.nager.at/api/v3/PublicHolidays/2026/IN")
    with urllib.request.urlopen(req) as response:
        holidays = json.loads(response.read().decode())
        print(f"Found {len(holidays)} holidays in 2026 for IN")
except Exception as e:
    print(f"API Error: {e}")
