"""Unblock students: reset yesterday's/today's TEST-locked attempts so the
real exams can be entered. Keeps the attempt rows (bundle continuity) but
clears locks/submissions and removes the stale test answers.
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from student.models import SEEAttempt, SEEAnswer
from cie.models import CIEAttempt

for a in SEEAttempt.objects.filter(is_locked=True):
    answers = SEEAnswer.objects.filter(attempt=a).count()
    SEEAnswer.objects.filter(attempt=a).delete()
    a.is_locked = False
    a.submitted_at = None
    a.proctor_strikes = 0
    a.save(update_fields=["is_locked", "submitted_at", "proctor_strikes"])
    print(f"SEE UNLOCKED: {a.student.usn} {a.subject.code} (deleted {answers} test answers)")

for a in CIEAttempt.objects.filter(is_locked=True):
    try:
        n = a.answers.count()
        a.answers.all().delete()
    except Exception:
        n = 0
    a.is_locked = False
    a.submitted_at = None
    a.submission_status = CIEAttempt.SubmissionStatus.IN_PROGRESS
    a.save(update_fields=["is_locked", "submitted_at", "submission_status"])
    print(f"CIE UNLOCKED: {a.student.usn} {a.cie_config.subject.code} (deleted {n} test answers)")

print("\nRemaining locked SEE:", SEEAttempt.objects.filter(is_locked=True).count())
print("Remaining locked CIE:", CIEAttempt.objects.filter(is_locked=True).count())
