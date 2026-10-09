"""Read-only: subjects, enrollments, eligibility state before adding marks."""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from scheduling.models import Subject, StudentSubjectEnrollment, ExamSession
from eligibility.models import StudentEligibility

print("== Sessions ==")
for s in ExamSession.objects.all().order_by("start_date"):
    print(f"  {s.id} {s.name!r} type={s.session_type} status={s.status} start={s.start_date}")

print("\n== Subjects + enrollments (per session) ==")
for sub in Subject.objects.all().order_by("code"):
    enrs = StudentSubjectEnrollment.objects.filter(subject=sub)
    by_sess = {}
    for e in enrs.values_list("exam_session__name", flat=True):
        by_sess[e] = by_sess.get(e, 0) + 1
    elig = StudentEligibility.objects.filter(subject=sub)
    elig_by_sess = {}
    for e in elig.values_list("exam_session__name", flat=True):
        elig_by_sess[e] = elig_by_sess.get(e, 0) + 1
    print(f"  {sub.code:<10} type={sub.subject_type:<8} enrollments={dict(by_sess)} eligibility={dict(elig_by_sess)}")

print("\n== Distinct students enrolled anywhere ==")
print(" ", StudentSubjectEnrollment.objects.values_list("student_id", flat=True).distinct().count())

print("\n== Subject model fields (for lab detection) ==")
print([f.name for f in Subject._meta.get_fields()])
