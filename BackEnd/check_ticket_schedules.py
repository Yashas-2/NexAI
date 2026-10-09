"""For every hall ticket: how many dated schedule entries does the app receive?"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from eligibility.models import HallTicket
from eligibility.serializers import HallTicketSerializer

empty, ok = [], []
for t in HallTicket.objects.select_related("student", "exam_session").order_by(
    "exam_session__session_type", "student__usn"
):
    sch = HallTicketSerializer(t).data.get("schedule") or []
    dated = [e for e in sch if e.get("exam_date")]
    row = (t.student.usn, t.exam_session.session_type, len(sch), len(dated))
    (ok if dated else empty).append(row)

print(f"Tickets with >=1 dated entry: {len(ok)}")
print(f"Tickets with EMPTY schedule (student sees 'No exam schedule'): {len(empty)}\n")
for usn, stype, total, dated in empty:
    print(f"  {usn:<12} {stype:<4} entries={total} dated={dated}")
