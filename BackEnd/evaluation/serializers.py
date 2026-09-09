from rest_framework import serializers
from .models import AnswerScript, ScriptPage, QuestionGrade
from users.serializers import UserSerializer

class ScriptPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScriptPage
        fields = ['id', 'page_number', 's3_url', 'quality_score', 'blur_detected', 'glare_detected', 'uploaded_at']

class QuestionGradeSerializer(serializers.ModelSerializer):
    question_number = serializers.IntegerField(source='question.question_number', read_only=True)
    question_part = serializers.CharField(source='question.part', read_only=True)
    max_marks = serializers.IntegerField(source='question.marks', read_only=True)

    class Meta:
        model = QuestionGrade
        fields = [
            'id', 'question', 'question_number', 'question_part', 'max_marks',
            'ai_suggested_score', 'ai_confidence', 'ai_feedback',
            'evaluator_score', 'override_reason', 'evaluated_at'
        ]
        read_only_fields = ['ai_suggested_score', 'ai_confidence', 'ai_feedback', 'evaluated_at']

class AnswerScriptSerializer(serializers.ModelSerializer):
    pages = ScriptPageSerializer(many=True, read_only=True)
    question_grades = QuestionGradeSerializer(many=True, read_only=True)
    subject_code = serializers.CharField(source='question_paper.subject.code', read_only=True)

    class Meta:
        model = AnswerScript
        fields = [
            'id', 'evaluation_code', 'question_paper', 'subject_code', 'scanning_session',
            'status', 'page_count', 'upload_complete', 'ai_total_score', 'evaluator_total_score',
            'max_marks', 'pages', 'question_grades', 'assigned_evaluator', 'evaluation_bundle'
        ]
        read_only_fields = ['status', 'ai_total_score', 'evaluator_total_score', 'upload_complete', 'assigned_evaluator', 'evaluation_bundle']

from .models import EvaluationBundle

class EvaluationBundleSerializer(serializers.ModelSerializer):
    evaluator_name = serializers.CharField(source='evaluator.full_name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    
    class Meta:
        model = EvaluationBundle
        fields = [
            'id', 'name', 'evaluator', 'evaluator_name', 'subject', 'subject_code',
            'exam_session', 'created_at', 'status'
        ]
