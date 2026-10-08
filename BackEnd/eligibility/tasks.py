"""NexAI - Eligibility Celery Tasks"""
import csv
import io
from decimal import Decimal
from celery import shared_task
from django.db import transaction

from .models import StudentEligibility, HallTicket
from users.models import Student
from scheduling.models import Subject, ExamSession


# Standard Default Thresholds
MIN_ATTENDANCE_PCT = Decimal("75.00")
MIN_CIE_MARKS = Decimal("40.00")


@shared_task
def process_eligibility_csv(file_content: str, session_id: str, department_id: str = None):
    """
    Parses a CSV string, calculates eligibility based on attendance and CIE marks,
    and updates or creates StudentEligibility records. Only processes students 
    belonging to the provided department_id if given.
    """
    reader = csv.DictReader(io.StringIO(file_content))
    processed = 0
    errors = []

    try:
        session = ExamSession.objects.get(id=session_id)
    except ExamSession.DoesNotExist:
        return {"status": "error", "message": "Exam Session not found"}

    for row in reader:
        usn = row.get("usn", "").strip()
        subject_code = row.get("subject_code", "").strip()
        
        try:
            attendance = Decimal(row.get("attendance", "0").strip())
            cie = Decimal(row.get("cie", "0").strip())
        except Exception:
            errors.append(f"Row {reader.line_num}: Invalid number format for {usn}")
            continue

        try:
            student = Student.objects.get(usn=usn)
            subject = Subject.objects.get(code=subject_code)
        except (Student.DoesNotExist, Subject.DoesNotExist):
            errors.append(f"Row {reader.line_num}: Student or Subject not found ({usn}, {subject_code})")
            continue
            
        if department_id and str(student.department_id) != str(department_id):
            errors.append(f"Row {reader.line_num}: Unauthorized. Student {usn} does not belong to your department.")
            continue

        is_eligible = True
        remarks = []
        
        if attendance < MIN_ATTENDANCE_PCT:
            is_eligible = False
            remarks.append(f"Shortage of attendance ({attendance}%)")
        if cie < MIN_CIE_MARKS:
            is_eligible = False
            remarks.append(f"Low CIE marks ({cie})")

        remark_str = " | ".join(remarks) if remarks else ""

        StudentEligibility.objects.update_or_create(
            student=student,
            subject=subject,
            exam_session=session,
            defaults={
                "attendance_percentage": attendance,
                "cie_marks": cie,
                "is_eligible": is_eligible,
                "remarks": remark_str
            }
        )
        processed += 1

    return {
        "status": "completed",
        "processed": processed,
        "errors": errors
    }


@shared_task
def generate_hall_tickets_for_session(session_id: str, department_id: str | None = None):
    """
    Generates Hall Tickets for all students who have at least one 
    eligible subject in the given session.
    """
    try:
        session = ExamSession.objects.get(id=session_id)
    except ExamSession.DoesNotExist:
        return {"status": "error", "message": "Exam Session not found"}

    # Get all students who have at least one eligible subject in this session
    eligible_students = Student.objects.filter(
        eligibility_records__exam_session=session,
        eligibility_records__is_eligible=True
    ).distinct()

    # Fallback: eligibility is tracked against the CIE session, so for SEE
    # sessions use each student's latest eligibility record (any session).
    if not eligible_students.exists():
        from scheduling.models import StudentSubjectEnrollment
        enrolled_ids = set(
            StudentSubjectEnrollment.objects.filter(
                exam_session=session
            ).values_list('student_id', flat=True)
        )
        if enrolled_ids:
            seen = set()
            eligible_ids = set()
            latest = StudentEligibility.objects.filter(
                student_id__in=enrolled_ids
            ).order_by('-updated_at', '-created_at').values_list(
                'student_id', 'subject_id', 'is_eligible'
            )
            for student_id, subject_id, is_eligible in latest:
                key = (student_id, subject_id)
                if key in seen:
                    continue
                seen.add(key)
                if is_eligible:
                    eligible_ids.add(student_id)
            # Only students with at least one eligible subject get a ticket
            eligible_students = Student.objects.filter(id__in=eligible_ids)

    if department_id:
        eligible_students = eligible_students.filter(department_id=department_id)

    created_count = 0

    with transaction.atomic():
        for student in eligible_students:
            # Create hall ticket if it doesn't exist
            _, created = HallTicket.objects.get_or_create(
                student=student,
                exam_session=session,
                defaults={
                    "qr_code_data": f"{student.usn}-{session_id}"
                }
            )
            if created:
                created_count += 1

    # Send notifications to students who received new hall tickets
    if created_count > 0:
        from notifications.helpers import notify_students_bulk
        notify_students_bulk(
            eligible_students,
            "HALL_TICKET",
            f"Hall Ticket Generated – {session.name}",
            f"Your hall ticket for {session.name} has been generated. Please check the Admit Card section.",
            related_object_id=session.id,
        )

    return {
        "status": "completed",
        "generated_count": created_count
    }
