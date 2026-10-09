"""Quick examine: all active invigilation duties with slot details."""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from scheduling.models import InvigilationDuty, TimetableSlot

print("== Active duties (slot not RESCHEDULED/CANCELLED) ==")
qs = (
    InvigilationDuty.objects.exclude(timetable_slot__status__in=["RESCHEDULED", "CANCELLED"])
    .select_related("timetable_slot__subject", "timetable_slot__room",
                    "timetable_slot__exam_session", "invigilator")
    .order_by("timetable_slot__exam_date", "timetable_slot__start_time")
)
for d in qs:
    s = d.timetable_slot
    print(f"  {s.exam_date} {str(s.start_time)[:5]}-{str(s.end_time)[:5]} "
          f"{d.duty_role:<8} {d.invigilator.email if d.invigilator else '-':<28} "
          f"{s.subject.code:<9} room={s.room.name:<6} status={s.status:<12} "
          f"session={s.exam_session.session_type}")

print("\n== Room conflicts: same room + date + overlapping time (active) ==")
active = list(qs)
seen = set()
for i, a in enumerate(active):
    sa = a.timetable_slot
    for b in active[i + 1:]:
        sb = b.timetable_slot
        if sa.room_id == sb.room_id and sa.exam_date == sb.exam_date:
            if sa.start_time < sb.end_time and sb.start_time < sa.end_time:
                key = (sa.id, sb.id)
                if key in seen:
                    continue
                seen.add(key)
                print(f"  {sa.exam_date} {sa.room.name}: "
                      f"{sa.subject.code} {sa.start_time}-{sa.end_time} vs "
                      f"{sb.subject.code} {sb.start_time}-{sb.end_time}")

print("\n== Invigilator conflicts: same person, overlapping duties ==")
for i, a in enumerate(active):
    sa = a.timetable_slot
    for b in active[i + 1:]:
        sb = b.timetable_slot
        if a.invigilator_id == b.invigilator_id and sa.exam_date == sb.exam_date:
            if sa.start_time < sb.end_time and sb.start_time < sa.end_time:
                print(f"  {a.invigilator.email} {sa.exam_date}: "
                      f"{sa.subject.code} {sa.start_time}-{sa.end_time} vs "
                      f"{sb.subject.code} {sb.start_time}-{sb.end_time}")

print("\n== Suspicious durations (active slots, <30 min or >6h) ==")
for s in TimetableSlot.objects.exclude(status__in=["RESCHEDULED", "CANCELLED"]).select_related("subject", "room"):
    dur = (s.end_time.hour * 60 + s.end_time.minute) - (s.start_time.hour * 60 + s.start_time.minute)
    if dur < 30 or dur > 360:
        print(f"  {s.exam_date} {s.subject.code} {s.start_time}-{s.end_time} "
              f"({dur} min) room={s.room.name} status={s.status} session={s.exam_session.session_type}")
