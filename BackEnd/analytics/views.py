"""NexAI Analytics – Views"""
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer
from student.models import Result
from core.permissions import IsChiefSuperintendent


class AuditLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    CoE read-only access to the immutable audit ledger.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsChiefSuperintendent]


class PerformanceMetricsViewSet(viewsets.ViewSet):
    """
    Institutional metrics for CoE Dashboard.
    """
    permission_classes = [IsAuthenticated, IsChiefSuperintendent]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Overall institutional summary: total evaluated, avg GPA, pass %."""
        total_results = Result.objects.count()
        if total_results == 0:
            return Response({
                "total_students_evaluated": 0,
                "average_gpa": 0,
                "pass_percentage": 0,
            })

        passed_results = Result.objects.exclude(grade__in=['F', 'ABSENT']).count()
        pass_percentage = (passed_results / total_results) * 100

        grade_points = {'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'F': 0, 'ABSENT': 0}
        total_points = 0
        valid_results = 0
        for result in Result.objects.all():
            if result.grade in grade_points:
                total_points += grade_points[result.grade]
                valid_results += 1

        average_gpa = total_points / valid_results if valid_results > 0 else 0

        return Response({
            "total_students_evaluated": total_results,
            "average_gpa": round(average_gpa, 2),
            "pass_percentage": round(pass_percentage, 1)
        })

    @action(detail=False, methods=['get'])
    def by_subject(self, request):
        """
        Pass/fail breakdown per subject.
        Returns a list of subjects with their student counts and pass percentages.
        Used by the frontend subject performance table.
        """
        subject_stats = (
            Result.objects
            .values(
                'subject__code',
                'subject__name',
            )
            .annotate(
                total=Count('id'),
                passed=Count('id', filter=~Q(grade__in=['F', 'ABSENT']))
            )
            .order_by('subject__code')
        )

        data = []
        for row in subject_stats:
            total = row['total']
            passed = row['passed']
            data.append({
                "subject_code": row['subject__code'],
                "subject_name": row['subject__name'],
                "total_students": total,
                "passed": passed,
                "failed": total - passed,
                "pass_percentage": round((passed / total * 100), 1) if total > 0 else 0,
            })

        return Response(data)
