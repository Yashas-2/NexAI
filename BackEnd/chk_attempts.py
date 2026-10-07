import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from cie.models import CIEAttempt
print("=== ALL ATTEMPTS ===")
attempts = CIEAttempt.objects.all()
print(f"Total attempts: {attempts.count()}")
for attempt in attempts:
    print(f"Attempt: {attempt.id} | Student: {attempt.student.usn} | Config: {attempt.cie_config.id} | Status: {attempt.submission_status}")
    answers = attempt.answers.all()
    print(f"  Total answers: {answers.count()}")
    for answer in answers:
        print(f"  - Answer: {answer.id} | Q: {answer.question_text[:30]} | marks: {answer.marks_awarded}")
