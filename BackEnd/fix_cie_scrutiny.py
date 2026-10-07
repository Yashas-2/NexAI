import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
from users.models import User

# Subject-specific questions for each course
SUBJECT_QUESTIONS = {
    'CS301': {
        'title': 'Deep Learning CIE 1 - Question Paper',
        'questions': [
            {'questionNumber': 1, 'questionText': 'Define Deep Learning. How does it differ from traditional Machine Learning? Explain with a diagram.', 'marks': 15, 'type': 'THEORY'},
            {'questionNumber': 2, 'questionText': 'Explain the backpropagation algorithm in detail. Derive the weight update equations for a 2-layer neural network.', 'marks': 20, 'type': 'THEORY'},
            {'questionNumber': 3, 'questionText': 'What are Convolutional Neural Networks (CNNs)? Describe the architecture components: Convolution, Pooling, and Fully Connected layers with their roles.', 'marks': 15, 'type': 'THEORY'},
        ]
    },
    'CS302': {
        'title': 'Data Science CIE 1 - Question Paper',
        'questions': [
            {'questionNumber': 1, 'questionText': 'Explain the data science lifecycle with all phases. What are the key challenges in each phase?', 'marks': 15, 'type': 'THEORY'},
            {'questionNumber': 2, 'questionText': 'What is Exploratory Data Analysis (EDA)? Describe the statistical methods and visualization techniques used in EDA.', 'marks': 20, 'type': 'THEORY'},
            {'questionNumber': 3, 'questionText': 'Differentiate between supervised and unsupervised learning. Give two examples and use cases for each.', 'marks': 15, 'type': 'THEORY'},
        ]
    },
    'CS303': {
        'title': 'Project Management CIE 1 - Question Paper',
        'questions': [
            {'questionNumber': 1, 'questionText': 'Define project management. What are the five process groups in the PMBOK framework? Explain each briefly.', 'marks': 15, 'type': 'THEORY'},
            {'questionNumber': 2, 'questionText': 'Explain Critical Path Method (CPM) and Program Evaluation and Review Technique (PERT). How do they help in project scheduling?', 'marks': 20, 'type': 'THEORY'},
            {'questionNumber': 3, 'questionText': 'What is Risk Management in projects? Describe the risk identification, analysis, and mitigation process with examples.', 'marks': 15, 'type': 'THEORY'},
        ]
    },
}

hod_user = User.objects.filter(role='HOD').first()
faculty_user = User.objects.filter(role='FACULTY').first()

print("Creating CIEQuestionPaperScrutiny records linked to correct CIEConfigs...\n")

for config in CIEConfiguration.objects.select_related('subject'):
    subject_code = config.subject.code
    q_data = SUBJECT_QUESTIONS.get(subject_code)
    
    if not q_data:
        print(f"  WARNING: No questions defined for {subject_code}, skipping.")
        continue
    
    # Check if scrutiny already exists
    try:
        existing = config.scrutiny
        print(f"  {subject_code}: Scrutiny already exists (ID={existing.id}, status={existing.status}), skipping.")
        continue
    except Exception:
        pass  # No scrutiny yet, create it
    
    paper_content = json.dumps({'questions': q_data['questions']})
    
    
    # Open time gate
    from datetime import datetime, timedelta, date
    past_time = (datetime.now() - timedelta(minutes=5)).time().replace(second=0, microsecond=0)
    config.scheduled_date = date.today()
    config.scheduled_time = past_time
    config.is_active = True
    config.save()
    
    scrutiny = CIEQuestionPaperScrutiny.objects.create(
        cie_config=config,
        paper_title=q_data['title'],
        paper_content=paper_content,
        answer_key='',
        submitted_by=faculty_user,
        reviewed_by=hod_user,
        status=CIEQuestionPaperScrutiny.ScrutinyStatus.APPROVED,
        review_note='Approved by HOD. All questions are relevant and within syllabus.',
    )
    print(f"  [OK] Created & APPROVED: {subject_code} CIE_1 -> Scrutiny ID={scrutiny.id}")

print("\n=== Final State ===")
for config in CIEConfiguration.objects.select_related('subject'):
    try:
        s = config.scrutiny
        print(f"  [{config.subject.code}] active={config.is_active} | date={config.scheduled_date} | time={config.scheduled_time} | scrutiny={s.status} | id={s.id}")
    except Exception:
        print(f"  [{config.subject.code}] active={config.is_active} | scrutiny=MISSING [ERROR]")

print("\nDone!")
