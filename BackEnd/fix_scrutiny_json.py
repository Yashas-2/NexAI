import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()
from cie.models import CIEQuestionPaperScrutiny
paper = CIEQuestionPaperScrutiny.objects.get(id='0fe2543e-4fa8-487f-9a09-4cb3b9834df9')
paper_data = {
    'questions': [
        {'questionNumber': 1, 'questionText': 'What is Deep Learning and how does it differ from Machine Learning?', 'marks': 10, 'type': 'THEORY'},
        {'questionNumber': 2, 'questionText': 'Explain the backpropagation algorithm with an example.', 'marks': 20, 'type': 'THEORY'},
        {'questionNumber': 3, 'questionText': 'What are Convolutional Neural Networks (CNNs)? Describe their architecture and applications.', 'marks': 20, 'type': 'THEORY'},
    ]
}
paper.paper_content = json.dumps(paper_data)
paper.save()
print('Updated paper_content with JSON!')

