import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from cie.models import CIEQuestionPaperScrutiny
from django.utils import timezone
from datetime import timedelta, datetime
import json

print('=== END-TO-END VERIFICATION ===\n')

for scrutiny in CIEQuestionPaperScrutiny.objects.select_related('cie_config__subject'):
    cfg = scrutiny.cie_config
    subject = cfg.subject.code
    print(f'Subject: {subject} ({cfg.get_cie_number_display()})')
    print(f'  Scrutiny ID : {scrutiny.id}')
    print(f'  Status      : {scrutiny.status}')
    print(f'  Date/Time   : {cfg.scheduled_date} {cfg.scheduled_time}')
    print(f'  is_active   : {cfg.is_active}')

    # Simulate time_release gate
    if cfg.scheduled_date and cfg.scheduled_time:
        exam_start = datetime.combine(cfg.scheduled_date, cfg.scheduled_time)
        exam_start = timezone.make_aware(exam_start)
        diff = exam_start - timezone.now()
        gate_open = diff <= timedelta(minutes=2)
        print(f'  Time gate   : {"OPEN  [PASS]" if gate_open else "CLOSED [FAIL - too early]"} (diff={diff})')
    else:
        print('  Time gate   : CLOSED [FAIL - no date/time set]')

    # Validate paper_content JSON
    try:
        content = json.loads(scrutiny.paper_content)
        questions = content.get('questions', [])
        print(f'  Questions   : {len(questions)} found [PASS]')
        for q in questions:
            qnum = q.get('questionNumber', '?')
            qtext = q.get('questionText', '')[:55]
            marks = q.get('marks', 0)
            print(f'    Q{qnum}: {qtext}... [{marks}m]')
    except Exception as e:
        print(f'  Questions   : INVALID JSON [FAIL] - {e}')
    print()
