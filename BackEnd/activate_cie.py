import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from cie.models import CIEConfiguration
from datetime import date, time, datetime, timedelta

# Set all CIE configurations with exam schedule so time_release works
configs = CIEConfiguration.objects.all()
print(f"Found {configs.count()} CIEConfiguration records")

for c in configs:
    changed = False
    if not c.scheduled_date:
        c.scheduled_date = date.today()
        changed = True
    if not c.scheduled_time:
        # Set to 2 minutes from now so students can immediately fetch
        t = (datetime.now() - timedelta(minutes=3)).time()
        c.scheduled_time = t.replace(second=0, microsecond=0)
        changed = True
    if not c.is_active:
        c.is_active = True
        changed = True
    if changed:
        c.save()
        print(f"  Updated {c.subject.code} {c.cie_number}: date={c.scheduled_date} time={c.scheduled_time} active={c.is_active}")
    else:
        print(f"  Already configured: {c.subject.code} {c.cie_number}: date={c.scheduled_date} time={c.scheduled_time} active={c.is_active}")

print("\nDone! CIE configs are now active and scheduled.")
print("\nCurrent state:")
for c in CIEConfiguration.objects.select_related('subject'):
    try:
        scrutiny_status = c.scrutiny.status
        scrutiny_id = str(c.scrutiny.id)
    except Exception:
        scrutiny_status = 'NO SCRUTINY'
        scrutiny_id = 'None'
    print(f"  [{c.subject.code}] {c.cie_number} | active={c.is_active} | date={c.scheduled_date} | time={c.scheduled_time} | scrutiny={scrutiny_status} | id={scrutiny_id}")
