"""Verify CS303 cleanup: SEE slots gone, CIE intact, cs001 SEE schedule empty."""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from scheduling.models import ExamSession, TimetableSlot
from eligibility.models import HallTicket
from eligibility.serializers import HallTicketSerializer

print("== Slots per session/status ==")
for e in ExamSession.objects.all():
    print(f"  session {e.name!r} type={e.session_type} start={e.start_date}")
    by_status = {}
    for s in e.timetable_slots.all():
        by_status.setdefault(s.status, []).append(s.subject.code)
    for st, codes in sorted(by_status.items()):
        print(f"    {st}: {len(codes)} -> {sorted(codes)}")

print("\n== Any slot seat_map containing 4MC23CS001 ==")
junk = TimetableSlot.objects.filter(seat_map__icontains="4MC23CS001")
for s in junk:
    print(f"  slot {s.id} {s.subject.code} {s.exam_date} {s.status} session={s.exam_session.name!r} type={s.exam_session.session_type}")
if not junk:
    print("  none (clean)")

print("\n== cs001 hall tickets (serializer live schedule) ==")
for t in HallTicket.objects.filter(student__usn="4MC23CS001").select_related("exam_session"):
    data = HallTicketSerializer(t).data
    sch = data.get("schedule") or []
    cie = sum(1 for x in sch if x.get("is_cie") is True)
    see = sum(1 for x in sch if x.get("is_cie") is False)
    print(f"  {t.ticket_number} session={t.exam_session.name!r} type={t.exam_session.session_type} "
          f"entries={len(sch)} CIE={cie} SEE={see} revoked={t.is_revoked} "
          f"session_start={t.exam_session.start_date}")
    for x in sch[:6]:
        print(f"      - {x.get('subject_code')} {x.get('exam_date')} is_cie={x.get('is_cie')} room={x.get('room')}")
