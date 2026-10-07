from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.models import Student
from eligibility.models import HallTicket, StudentEligibility
from eligibility.serializers import HallTicketSerializer
from evaluation.models import AnswerScriptKeyMap
from .models import Result
from .serializers import ResultSerializer

class StudentPortalViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_student(self, user):
        try:
            return Student.objects.get(user=user)
        except Student.DoesNotExist:
            return None

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            "usn": student.usn,
            "name": student.user.full_name,
            "department": student.department.name,
            "semester": student.current_semester,
            "batch_year": student.batch_year
        })

    @action(detail=False, methods=['get'])
    def my_hall_tickets(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        hall_tickets = HallTicket.objects.filter(student=student)
        serializer = HallTicketSerializer(hall_tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_results(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # For MVP: Dynamically fetch AnswerScript SEE marks and update/create Result.
        # We need to find all AnswerScriptKeyMap for this student.
        key_maps = AnswerScriptKeyMap.objects.filter(student=student).select_related('answer_script')
        
        for key_map in key_maps:
            script = key_map.answer_script
            if script.status == 'COMPLETED':
                # Find the timetable slot to get subject and session
                # The AnswerScript belongs to an ExamSession and a Subject
                # Oh wait, AnswerScript belongs to ScanningSession -> TimetableSlot -> Subject
                timetable_slot = script.scanning_session.timetable_slot
                
                # Fetch or create the Result record
                result, created = Result.objects.get_or_create(
                    student=student,
                    subject=timetable_slot.subject,
                    exam_session=timetable_slot.exam_session,
                    defaults={
                        'cie_marks': 40.00 # Mock CIE marks for MVP if not already in system
                    }
                )
                
                # Update SEE marks
                if result.see_marks != script.evaluator_total_score:
                    result.see_marks = script.evaluator_total_score
                    result.save() # This triggers the grade calculation
                    
        # Now return all results
        results = Result.objects.filter(student=student).order_by('-exam_session__start_date', 'subject__code')
        serializer = ResultSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_enrollments(self, request):
        from scheduling.models import StudentSubjectEnrollment
        from scheduling.serializers import StudentSubjectEnrollmentSerializer
        
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        enrollments = StudentSubjectEnrollment.objects.filter(student=student).select_related(
            "subject", "exam_session"
        ).order_by('-enrolled_at')
        
        # Deduplicate
        seen_subjects = set()
        unique_enrollments = []
        for enrollment in enrollments:
            if enrollment.subject_id not in seen_subjects:
                unique_enrollments.append(enrollment)
                seen_subjects.add(enrollment.subject_id)
        
        serializer = StudentSubjectEnrollmentSerializer(unique_enrollments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_cie_schedule(self, request):
        """Returns CIE schedule info for the student including hall/seat allocation."""
        from scheduling.models import ExamSession
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        from scheduling.models import TimetableSlot

        # Get CIE sessions the student is enrolled in
        cie_sessions = ExamSession.objects.filter(
            session_type='CIE',
            student_enrollments__student=student,
        ).distinct()

        schedule = []
        for session in cie_sessions:
            # Get timetable slots for this session
            slots = TimetableSlot.objects.filter(
                exam_session=session,
                seat_map__has_key=student.usn,
            ).select_related('subject', 'room')

            for slot in slots:
                seat = (slot.seat_map or {}).get(student.usn, 'Unassigned')
                schedule.append({
                    'session_name': session.name,
                    'subject_code': slot.subject.code,
                    'subject_name': slot.subject.name,
                    'date': slot.exam_date,
                    'start_time': slot.start_time,
                    'end_time': slot.end_time,
                    'room': slot.room.name if slot.room else 'TBA',
                    'seat': seat,
                })
        return Response(schedule)

    @action(detail=False, methods=['get'])
    def my_attendance(self, request):
        student = self._get_student(request.user)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
            
        slot_id = request.query_params.get('slot_id')
        if not slot_id:
            return Response({"error": "slot_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from scheduling.models import StudentExamAttendance
        attendance = StudentExamAttendance.objects.filter(timetable_slot_id=slot_id, student=student).first()
        if attendance:
            return Response({
                "is_present": attendance.status.lower() == 'present',
                "is_qr_verified": attendance.is_qr_verified
            })
        return Response({
            "is_present": False,
            "is_qr_verified": False
        })


class SEETestViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get', 'post'])
    def test_endpoint(self, request):
        return Response({"status": "ok"})
