"""Add random CIE marks + attendance for existing subjects' enrolled students.

- Touches ONLY StudentEligibility (marks/attendance) — no subjects/sessions created.
- Existing records (e.g. CS303 synced from the faculty dashboard) are left untouched.
- Random values mirror FacultyMarksSyncView: attendance 70-100, CIE1-3 0-10 each,
  cie_marks = sum, eligibility = attendance >= 85 and cie >= 12 (theory, no lab).
- Records go to the CIE session, exactly like the dashboard's sync-marks endpoint.
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

random.seed()  # true random

cie_session = ExamSession.objects.filter(
    session_type="CIE", status__in=["ACTIVE", "SCHEDULED", "DRAFT"]
).order_by("-created_at").first()
if not cie_session:
    sys.exit("No CIE session found — aborting.")
print(f"CIE session: {cie_session.name} ({cie_session.id})\n")

created = updated = kept = 0
summary = []

for sub in Subject.objects.all().order_by("code"):
    # students enrolled in this subject (any session)
    student_ids = set(
        StudentSubjectEnrollment.objects.filter(subject=sub)
        .values_list("student_id", flat=True)
    )
    if not student_ids:
        summary.append((sub.code, 0, 0, 0, 0))
        continue

    existing = {
        r.student_id: r
        for r in StudentEligibility.objects.filter(subject=sub, exam_session=cie_session)
    }
    students_map = {s.id: s for s in Student.objects.filter(id__in=student_ids)}

    sub_created = sub_updated = sub_kept = sub_inelig = 0
    for sid in student_ids:
        if sid in existing:
            sub_kept += 1
            continue

        attendance = Decimal(random.randint(70, 100))
        cie1 = Decimal(random.randint(0, 10))
        cie2 = Decimal(random.randint(0, 10))
        cie3 = Decimal(random.randint(0, 10))
        cie_marks = (cie1 + cie2 + cie3).quantize(Decimal("0.01"))

        remarks = []
        if attendance < Decimal("85.00"):
            remarks.append(f"Shortage of attendance ({attendance}%)")
        if cie_marks < Decimal("12.00"):
            remarks.append(f"Low CIE marks ({cie_marks:.2f})")
        is_eligible = not remarks

        student = students_map[sid]
        StudentEligibility.objects.create(
            student=student,
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
        sub_created += 1
        if not is_eligible:
            sub_inelig += 1

    created += sub_created
    kept += sub_kept
    summary.append((sub.code, len(student_ids), sub_created, sub_kept, sub_inelig))

print(f"{'SUBJECT':<10} {'ENROLLED':>8} {'ADDED':>6} {'KEPT':>5} {'NEW INELIGIBLE':>15}")
for code, total, add, keep, inel in summary:
    print(f"{code:<10} {total:>8} {add:>6} {keep:>5} {inel:>15}")

total_elig = StudentEligibility.objects.filter(exam_session=cie_session, is_eligible=True).count()
total_all = StudentEligibility.objects.filter(exam_session=cie_session).count()
print(f"\nCIE session eligibility totals: {total_all} records, {total_elig} eligible")
print(f"Created={created} kept_existing={kept} updated={updated}")
