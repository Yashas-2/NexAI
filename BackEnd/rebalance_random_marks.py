"""Rebalance the random marks I just added: delete only those, regenerate
with a realistic distribution (~78% eligible, some attendance shortage /
low-CIE cases). CS303's user-synced records are never touched.
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

random.seed()

cie_session = ExamSession.objects.filter(
    session_type="CIE", status__in=["ACTIVE", "SCHEDULED", "DRAFT"]
).order_by("-created_at").first()

# 1) Delete ONLY the records my previous run created (every subject except CS303)
to_delete = StudentEligibility.objects.filter(exam_session=cie_session).exclude(
    subject__code="CS303"
)
deleted, _ = to_delete.delete()
print(f"Deleted my previous random records: {deleted}")

created = 0
rows = []
for sub in Subject.objects.all().order_by("code"):
    if sub.code == "CS303":
        continue  # keep user's real data
    student_ids = set(
        StudentSubjectEnrollment.objects.filter(subject=sub)
        .values_list("student_id", flat=True)
    )
    if not student_ids:
        continue
    students_map = {s.id: s for s in Student.objects.filter(id__in=student_ids)}

    n_inelig = 0
    for sid in student_ids:
        # Realistic attendance: mostly 85+, a minority short of 85
        if random.random() < 0.78:
            attendance = Decimal(random.randint(85, 100))
        else:
            attendance = Decimal(random.randint(70, 84))
        # CIE1-3 each out of 10; a small group scores low
        if random.random() < 0.85:
            cie1, cie2, cie3 = (Decimal(random.randint(5, 10)) for _ in range(3))
        else:
            cie1, cie2, cie3 = (Decimal(random.randint(0, 6)) for _ in range(3))
        cie_marks = (cie1 + cie2 + cie3).quantize(Decimal("0.01"))

        remarks = []
        if attendance < Decimal("85.00"):
            remarks.append(f"Shortage of attendance ({attendance}%)")
        if cie_marks < Decimal("12.00"):
            remarks.append(f"Low CIE marks ({cie_marks:.2f})")
        is_eligible = not remarks
        if not is_eligible:
            n_inelig += 1

        StudentEligibility.objects.create(
            student=students_map[sid],
            subject=sub,
            exam_session=cie_session,
            attendance_percentage=attendance,
            cie1_marks=cie1,
            cie2_marks=cie2,
            cie3_marks=cie3,
            assignment_marks=None,
            cie_marks=cie_marks,
            is_eligible=is_eligible,
            remarks=" | ".join(remarks),
        )
        created += 1
    rows.append((sub.code, len(student_ids), n_inelig))

print(f"\n{'SUBJECT':<10} {'STUDENTS':>8} {'INELIGIBLE':>10}")
for code, total, inel in rows:
    print(f"{code:<10} {total:>8} {inel:>10}")

total_all = StudentEligibility.objects.filter(exam_session=cie_session).count()
total_elig = StudentEligibility.objects.filter(exam_session=cie_session, is_eligible=True).count()
print(f"\nCreated={created}")
print(f"CIE session: {total_all} records, {total_elig} eligible, "
      f"{total_all - total_elig} ineligible ({100 * (total_all - total_elig) // total_all}% ineligible)")
