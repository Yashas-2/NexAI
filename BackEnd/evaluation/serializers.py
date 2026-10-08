from rest_framework import serializers
from .models import AnswerScript, ScriptPage, QuestionGrade
from users.serializers import UserSerializer
from django.db.models import Count, Q

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
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    exam_session_name = serializers.CharField(source='exam_session.name', read_only=True)
    booklets_total = serializers.SerializerMethodField()
    booklets_evaluated = serializers.SerializerMethodField()
    booklets_remaining = serializers.SerializerMethodField()
    evaluation_status = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationBundle
        fields = [
            'id', 'name', 'evaluator', 'evaluator_name', 'subject', 'subject_code',
            'subject_name', 'exam_session', 'exam_session_name', 'created_at',
            'status', 'evaluation_status', 'access_code', 'redeemed_at',
            'booklets_total', 'booklets_evaluated', 'booklets_remaining',
        ]

    def _progress(self, obj):
        """(total, evaluated) answer booklets — evaluated = fully graded."""
        if not hasattr(obj, "_me_progress"):
            rows = obj.attempts_qs().annotate(
                n_total=Count("answers"),
                n_graded=Count("answers", filter=Q(answers__marks_awarded__isnull=False)),
            )
            total = evaluated = 0
            for r in rows:
                total += 1
                if r.n_total > 0 and r.n_graded == r.n_total:
                    evaluated += 1
            obj._me_progress = (total, evaluated)
        return obj._me_progress

    def get_booklets_total(self, obj):
        return self._progress(obj)[0]

    def get_booklets_evaluated(self, obj):
        return self._progress(obj)[1]

    def get_booklets_remaining(self, obj):
        total, evaluated = self._progress(obj)
        return max(total - evaluated, 0)

    def get_evaluation_status(self, obj):
        """User-facing pipeline status including Partially Evaluated."""
        if obj.status == "IN_PROGRESS":
            total, evaluated = self._progress(obj)
            if 0 < evaluated < total:
                return "PARTIALLY_EVALUATED"
        return obj.status
