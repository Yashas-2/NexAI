from rest_framework import serializers
from .models import Result

class ResultSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject = serializers.CharField(source='subject.name', read_only=True)
    exam_session_name = serializers.CharField(source='exam_session.name', read_only=True)
    credits = serializers.IntegerField(source='subject.credits', read_only=True)

    class Meta:
        model = Result
        fields = [
            'id', 'subject', 'subject_code', 'subject_name', 'exam_session_name', 'credits',
            'cie_marks', 'see_marks', 'see_converted_marks', 'total_marks', 'grade',
            'is_published', 'announced_at', 'published_at'
        ]

from .models import SEEAttempt, SEEAnswer

class SEEAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SEEAnswer
        fields = ['id', 'question', 'answer_text', 'marks_awarded']
        read_only_fields = ['id', 'marks_awarded']

class SEEAttemptSerializer(serializers.ModelSerializer):
    answers = SEEAnswerSerializer(many=True, read_only=True)
    
    class Meta:
        model = SEEAttempt
        fields = [
            'id', 'student', 'subject', 'exam_session', 'session_key',
            'started_at', 'submitted_at', 'is_locked', 'answers'
        ]
        read_only_fields = ['id', 'started_at', 'submitted_at', 'is_locked']
