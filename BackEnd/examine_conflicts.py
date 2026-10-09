"""Examine: CIE config times vs slots; SEE seat overlap in CRB-2; room capacity."""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from scheduling.models import TimetableSlot, Room
from cie.models import CIEConfiguration

print("== Rooms ==")
for r in Room.objects.all():
    print(f"  {r.name} capacity={getattr(r, 'capacity', '?')}")

print("\n== CIEConfiguration (what the CIE exam times SHOULD be) ==")
for c in CIEConfiguration.objects.select_related("subject", "exam_session").order_by("subject__code", "cie_number"):
    print(f"  {c.subject.code} CIE{c.cie_number} session={c.exam_session.session_type} "
          f"scheduled_date={c.scheduled_date} scheduled_time={c.scheduled_time} "
          f"duration={c.duration_mins}min room={getattr(c, 'room', None)}")

print("\n== Active CIE slots (actual) ==")
for s in TimetableSlot.objects.filter(exam_session__session_type="CIE").exclude(
    status__in=["RESCHEDULED", "CANCELLED"]
).select_related("subject", "room"):
    print(f"  {s.subject.code} {s.exam_date} {s.start_time}-{s.end_time} room={s.room.name} status={s.status}")

print("\n== SEE 10-09 slots: seat overlap in same room ==")
slots = TimetableSlot.objects.filter(
    exam_session__session_type="SEE", exam_date="2026-10-09"
).exclude(status__in=["RESCHEDULED", "CANCELLED"]).select_related("subject", "room")
slots = list(slots)
for s in slots:
    print(f"  {s.subject.code} room={s.room.name} {s.start_time}-{s.end_time} "
          f"seated={len(s.seat_map or {})}")
for i, a in enumerate(slots):
    for b in slots[i + 1:]:
        if a.room_id == b.room_id:
            sa, sb = set(a.seat_map or {}), set(b.seat_map or {})
            both = sa & sb
            coords_a = set((a.seat_map or {}).values())
            coords_b = set((b.seat_map or {}).values())
            seat_clash = coords_a & coords_b
            print(f"  {a.subject.code} vs {b.subject.code} in {a.room.name}: "
                  f"same students={len(both)} same seat coords={len(seat_clash)} "
                  f"({sorted(seat_clash)[:6]}{'...' if len(seat_clash) > 6 else ''})")
