"""Fix invigilator duty conflicts:

1. SEE: split CRB-2 seat grids per date so CS and MECH cohorts use disjoint
   row blocks (CS rows 1-5, MECH rows 6-10) — combined hall, capacity 100,
   cohorts 40-42 each. Removes every double-booked seat coordinate.
2. CIE: replace junk durations (5/6/16 min) with a sane sequential schedule
   ending before the 14:00 SEE start (same students sit all three CIEs):
     CS301 12:10-12:40, CS302 12:45-13:15, CS303 13:20-13:50
   Updates both CIEConfiguration and the TimetableSlot (duties read the slot).
"""
import os
import sys
from datetime import datetime, timedelta, time as dtime
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from scheduling.models import TimetableSlot
from cie.models import CIEConfiguration

# ── 1. Reseat SEE slots ──────────────────────────────────────────────────────
def coords_for(rows):
    out = []
    for r in rows:
        for c in range(1, 11):
            out.append(f"R{r}-S{c}")
    return out

CS_ROWS = list(range(1, 6))    # R1-R5  -> 50 positions
MECH_ROWS = list(range(6, 11)) # R6-R10 -> 50 positions

see_slots = TimetableSlot.objects.filter(
    exam_session__session_type="SEE"
).exclude(status__in=["RESCHEDULED", "CANCELLED"]).select_related("subject")

for s in see_slots:
    usns = sorted(s.seat_map or {})
    if not usns:
        print(f"  {s.exam_date} {s.subject.code}: no seats, skipped")
        continue
    rows = CS_ROWS if s.subject.code.startswith("CS") else MECH_ROWS
    coords = coords_for(rows)
    assert len(usns) <= len(coords), (
        f"{s.subject.code} has {len(usns)} students > block size {len(coords)}"
    )
    new_map = dict(zip(usns, coords))
    old = s.seat_map
    if new_map == old:
        print(f"  {s.exam_date} {s.subject.code}: already split")
        continue
    s.seat_map = new_map
    s.save(update_fields=["seat_map"])
    print(f"  {s.exam_date} {s.subject.code}: reseated {len(usns)} students "
          f"-> rows {rows[0]}-{rows[-1]}")

# ── 2. Fix CIE durations ─────────────────────────────────────────────────────
CIE_FIX = {
    "CS301": (dtime(12, 10), 30),
    "CS302": (dtime(12, 45), 30),
    "CS303": (dtime(13, 20), 30),
}

for code, (start, mins) in CIE_FIX.items():
    end = (datetime.combine(datetime.today(), start) + timedelta(minutes=mins)).time()

    cfg = CIEConfiguration.objects.filter(
        subject__code=code, exam_session__session_type="CIE"
    ).first()
    if cfg:
        cfg.scheduled_time = start
        cfg.duration_mins = mins
        cfg.save(update_fields=["scheduled_time", "duration_mins"])

    slot = TimetableSlot.objects.filter(
        exam_session__session_type="CIE", subject__code=code
    ).exclude(status__in=["RESCHEDULED", "CANCELLED"]).first()
    if slot:
        slot.start_time = start
        slot.end_time = end
        slot.save(update_fields=["start_time", "end_time"])
        print(f"  CIE {code}: {start.strftime('%H:%M')}-{end.strftime('%H:%M')} "
              f"({mins} min) config+slot updated")

print("\nDone.")
