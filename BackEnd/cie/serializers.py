"""NexAI CIE – Serializers"""
from rest_framework import serializers
from .models import CIEConfiguration, CIEMarks, AssignmentMarks, CIEQuestionPaperScrutiny
from users.serializers import StudentSerializer


class CIEConfigurationSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    department_code = serializers.CharField(source='subject.department.code', read_only=True)
    faculty_name = serializers.CharField(source='assigned_faculty.full_name', read_only=True, default='Unassigned')
    session_name = serializers.CharField(source='exam_session.name', read_only=True)

    class Meta:
        model = CIEConfiguration
        fields = [
            'id', 'subject', 'subject_code', 'subject_name', 'department_code',
            'exam_session', 'session_name', 'cie_number',
            'assigned_faculty', 'faculty_name',
            'max_marks', 'duration_mins', 'scheduled_date', 'scheduled_time',
            'is_active', 'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class CIEMarksSerializer(serializers.ModelSerializer):
    student_usn = serializers.CharField(source='student.usn', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    subject_code = serializers.CharField(source='cie_config.subject.code', read_only=True)
    cie_number = serializers.CharField(source='cie_config.cie_number', read_only=True)
    max_marks = serializers.IntegerField(source='cie_config.max_marks', read_only=True)
    percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = CIEMarks
        fields = [
            'id', 'student', 'student_usn', 'student_name',
            'cie_config', 'subject_code', 'cie_number',
            'marks_awarded', 'max_marks', 'percentage',
            'is_absent', 'remarks',
            'entered_by', 'entered_at', 'updated_at',
        ]
        read_only_fields = ['entered_by', 'entered_at', 'updated_at']


class AssignmentMarksSerializer(serializers.ModelSerializer):
    student_usn = serializers.CharField(source='student.usn', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)

    class Meta:
        model = AssignmentMarks
        fields = [
            'id', 'student', 'student_usn', 'student_name',
            'subject', 'subject_code', 'exam_session',
            'marks_awarded', 'max_marks',
            'entered_by', 'entered_at',
        ]
        read_only_fields = ['entered_by', 'entered_at']


class CIEQuestionPaperScrutinySerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source='cie_config.subject.code', read_only=True)
    cie_number = serializers.CharField(source='cie_config.cie_number', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True, default='')
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, default='')

    class Meta:
        model = CIEQuestionPaperScrutiny
        fields = [
            'id', 'cie_config', 'subject_code', 'cie_number',
            'paper_title', 'paper_content', 'answer_key',
            'submitted_by', 'submitted_by_name', 'submitted_at',
            'status', 'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at']


class CIEAggregateSerializer(serializers.Serializer):
    """Result of CIE aggregate calculation for a student/subject."""
    student_usn = serializers.CharField()
    student_name = serializers.CharField()
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    cie_1_marks = serializers.FloatField(allow_null=True)
    cie_2_marks = serializers.FloatField(allow_null=True)
    cie_3_marks = serializers.FloatField(allow_null=True)
    assignment_marks = serializers.FloatField(allow_null=True)
    cie_average = serializers.FloatField(allow_null=True)
    total_internal = serializers.FloatField(allow_null=True)
    is_complete = serializers.BooleanField()


from .models import CIEAttempt, CIEAnswer

class CIEAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CIEAnswer
        fields = ['id', 'question_text', 'answer_text', 'answer_image_base64', 'extracted_text', 'marks_awarded']
        read_only_fields = ['marks_awarded']

class CIEAttemptSerializer(serializers.ModelSerializer):
    answers = CIEAnswerSerializer(many=True, read_only=True)
    subject_code = serializers.CharField(source='cie_config.subject.code', read_only=True)
    cie_number = serializers.CharField(source='cie_config.cie_number', read_only=True)
    student_usn = serializers.CharField(source='student.usn', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = CIEAttempt
        fields = ['id', 'student', 'student_usn', 'student_name', 'cie_config', 'subject_code', 'cie_number', 'started_at', 'submitted_at', 'is_locked', 'submission_status', 'answers']
        read_only_fields = ['started_at', 'submitted_at', 'is_locked', 'submission_status']
