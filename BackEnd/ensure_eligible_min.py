"""Guarantee >=36 eligible students per subject.

- My 5 random subjects: regenerated with a realistic pass-heavy distribution.
- CS303 (user's synced records): untouched unless below the 36 minimum —
  only then are the fewest possible ineligible records nudged to eligible
  (attendance -> >=85, CIE sum -> >=12).
"""
import os
import sys
import random
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from decimal import Decimal

from scheduling.models import Subject, StudentSubjectEnrollment, ExamSession
from eligibility.models import StudentEligibility
from users.models import Student

MIN_ELIGIBLE = 36
random.seed()

cie_session = ExamSession.objects.filter(
    session_type="CIE", status__in=["ACTIVE", "SCHEDULED", "DRAFT"]
).order_by("-created_at").first()

MY_SUBJECTS = {"CS301", "CS302", "MECH701", "MECH702", "MECH703"}


def make_passing_pair():
    """attendance >=85 and cie sum >=12 — both conditions guaranteed."""
    attendance = Decimal(random.randint(85, 100))
    if random.random() < 0.9:
        c1, c2 = (Decimal(random.randint(5, 10)) for _ in range(2))
    else:
        c1, c2 = (Decimal(random.randint(3, 4)) for _ in range(2))
    needed = 12 - int(c1) - int(c2)
    if needed > 0:
        c3 = Decimal(min(10, needed + random.randint(0, 2)))
    else:
        c3 = Decimal(random.randint(0, 10))
    return attendance, c1, c2, c3


def make_random_pair():
    """Free-random values (may fail eligibility)."""
    if random.random() < 0.9:
        attendance = Decimal(random.randint(85, 100))
    else:
        attendance = Decimal(random.randint(75, 84))
    if random.random() < 0.95:
        c1, c2, c3 = (Decimal(random.randint(5, 10)) for _ in range(3))
    else:
        c1, c2, c3 = (Decimal(random.randint(0, 6)) for _ in range(3))
    return attendance, c1, c2, c3


def remarks_for(att, cie):
    r = []
    if att < Decimal("85.00"):
        r.append(f"Shortage of attendance ({att}%)")
    if cie < Decimal("12.00"):
        r.append(f"Low CIE marks ({cie:.2f})")
    return " | ".join(r)


rows = []
for sub in Subject.objects.all().order_by("code"):
    student_ids = set(
        StudentSubjectEnrollment.objects.filter(subject=sub)
        .values_list("student_id", flat=True)
    )
    if not student_ids:
        continue
    students_map = {s.id: s for s in Student.objects.filter(id__in=student_ids)}
    elig_qs = StudentEligibility.objects.filter(subject=sub, exam_session=cie_session)

    if sub.code in MY_SUBJECTS:
        elig_qs.delete()
        for sid in student_ids:
            att, c1, c2, c3 = make_random_pair()
            cie = (c1 + c2 + c3).quantize(Decimal("0.01"))
            is_elig = att >= Decimal("85.00") and cie >= Decimal("12.00")
            StudentEligibility.objects.create(
                student=students_map[sid], subject=sub, exam_session=cie_session,
                attendance_percentage=att, cie1_marks=c1, cie2_marks=c2,
                cie3_marks=c3, assignment_marks=None, cie_marks=cie,
                is_eligible=is_elig, remarks="" if is_elig else remarks_for(att, cie),
            )

    # Guarantee the floor: nudge ineligible records until MIN_ELIGIBLE pass
    nudged = 0
    while True:
        eligible_count = elig_qs.filter(is_eligible=True).count()
        if eligible_count >= MIN_ELIGIBLE:
            break
        rec = elig_qs.filter(is_eligible=False).first()
        if rec is None:
            break
        att, c1, c2, c3 = make_passing_pair()
        cie = (c1 + c2 + c3).quantize(Decimal("0.01"))
        rec.attendance_percentage = att
        rec.cie1_marks, rec.cie2_marks, rec.cie3_marks = c1, c2, c3
        rec.cie_marks = cie
        rec.is_eligible = True
        rec.remarks = ""
        rec.save(update_fields=[
            "attendance_percentage", "cie1_marks", "cie2_marks", "cie3_marks",
            "cie_marks", "is_eligible", "remarks",
        ])
        nudged += 1

    total = StudentEligibility.objects.filter(subject=sub, exam_session=cie_session).count()
    elig = elig_qs.filter(is_eligible=True).count()
    rows.append((sub.code, total, elig, total - elig, nudged))

print(f"{'SUBJECT':<10} {'TOTAL':>6} {'ELIGIBLE':>9} {'INELIGIBLE':>11} {'NUDGED':>7}")
for code, total, elig, inel, nudged in rows:
    flag = "" if elig >= MIN_ELIGIBLE else "  <-- BELOW 36!"
    print(f"{code:<10} {total:>6} {elig:>9} {inel:>11} {nudged:>7}{flag}")

bad = [r for r in rows if r[2] < MIN_ELIGIBLE]
print("\nRESULT:", "ALL SUBJECTS >= 36 ELIGIBLE" if not bad else f"FAIL: {bad}")
