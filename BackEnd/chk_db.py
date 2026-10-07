import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from scheduling.models import ExamSession, Subject, TimetableSlot
from cie.models import CIEConfiguration, CIEQuestionPaperScrutiny
from users.models import User, Student
from eligibility.models import HallTicket

student = Student.objects.first()
print(f"Student: {student.usn}")

sessions = ExamSession.objects.filter(session_type='CIE')
for session in sessions:
    slots = TimetableSlot.objects.filter(exam_session=session)
    for slot in slots:
        print(f"Slot: {slot.subject.code} - {slot.subject.name} - {slot.exam_date}")
        config, created = CIEConfiguration.objects.get_or_create(
            subject=slot.subject,
            exam_session=session,
            cie_number=1,
            defaults={
                'max_marks': 50,
                'duration_mins': 90,
            }
        )
        if hasattr(config, 'scrutiny'):
            scrutiny = config.scrutiny
        else:
            paper_data = {
                'questions': [
                    {'questionNumber': 1, 'questionText': 'What is Deep Learning and how does it differ from Machine Learning?', 'marks': 10, 'type': 'THEORY'},
                    {'questionNumber': 2, 'questionText': 'Explain the backpropagation algorithm with an example.', 'marks': 20, 'type': 'THEORY'},
                    {'questionNumber': 3, 'questionText': 'What are Convolutional Neural Networks (CNNs)? Describe their architecture and applications.', 'marks': 20, 'type': 'THEORY'},
                ]
            }
            faculty_user = User.objects.filter(role='FACULTY').first()
            scrutiny = CIEQuestionPaperScrutiny.objects.create(
                cie_config=config,
                submitted_by=faculty_user,
                reviewed_by=User.objects.filter(role='HOD').first(),
                status=CIEQuestionPaperScrutiny.ScrutinyStatus.APPROVED,
                paper_title="CIE 1 Question Paper",
                paper_content=json.dumps(paper_data),
            )
            print(f"Created CIEQuestionPaperScrutiny {scrutiny.id} for {slot.subject.name}")
