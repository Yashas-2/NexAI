"""NexAI CIE – Services (business logic)"""
from decimal import Decimal
from typing import Optional, Dict, Any


def compute_cie_aggregate(student_id: str, subject_id: str, session_id: str) -> Dict[str, Any]:
    """
    Compute a student's CIE aggregate for a specific subject and exam session.
    
    Rules (configurable, currently: average of best 2 of 3 CIEs + assignment):
    - CIE average = average of best 2 of 3 CIEs (out of 50 each → scaled to 30)
    - Assignment = out of 10
    - Total internal = CIE avg (scaled) + Assignment
    
    Returns a dict with individual CIE marks, average, and total internal.
    """
    from .models import CIEConfiguration, CIEMarks, AssignmentMarks
    from users.models import Student
    from scheduling.models import Subject, ExamSession

    try:
        student = Student.objects.get(id=student_id)
        subject = Subject.objects.get(id=subject_id)
        session = ExamSession.objects.get(id=session_id)
    except Exception as e:
        return {"error": str(e)}

    cie_marks = {}
    for cie_num in ['CIE_1', 'CIE_2', 'CIE_3']:
        try:
            config = CIEConfiguration.objects.get(subject=subject, exam_session=session, cie_number=cie_num)
            mark_obj = CIEMarks.objects.get(student=student, cie_config=config)
            if mark_obj.is_absent:
                cie_marks[cie_num] = None
            else:
                cie_marks[cie_num] = float(mark_obj.marks_awarded)
        except (CIEConfiguration.DoesNotExist, CIEMarks.DoesNotExist):
            cie_marks[cie_num] = None

    # Best 2 of 3 (ignoring None/absent)
    valid_marks = [v for v in cie_marks.values() if v is not None]
    cie_average: Optional[float] = None
    if len(valid_marks) >= 2:
        best_two = sorted(valid_marks, reverse=True)[:2]
        cie_average = sum(best_two) / 2  # out of 50

    # Scale CIE average from /50 to /30 (VTU standard: CIE is 30% of 100)
    cie_scaled: Optional[float] = None
    if cie_average is not None:
        cie_scaled = round((cie_average / 50) * 30, 2)

    # Assignment marks
    assignment: Optional[float] = None
    try:
        asgn = AssignmentMarks.objects.get(student=student, subject=subject, exam_session=session)
        assignment = float(asgn.marks_awarded)
    except AssignmentMarks.DoesNotExist:
        assignment = None

    # Total internal (out of 40 = 30 CIE + 10 Assignment)
    total_internal: Optional[float] = None
    if cie_scaled is not None and assignment is not None:
        total_internal = round(cie_scaled + assignment, 2)

    is_complete = all(v is not None for v in cie_marks.values()) and assignment is not None

    return {
        "student_usn": student.usn,
        "student_name": student.user.full_name,
        "subject_code": subject.code,
        "subject_name": subject.name,
        "cie_1_marks": cie_marks.get('CIE_1'),
        "cie_2_marks": cie_marks.get('CIE_2'),
        "cie_3_marks": cie_marks.get('CIE_3'),
        "assignment_marks": assignment,
        "cie_average": round(cie_average, 2) if cie_average is not None else None,
        "cie_scaled_to_30": cie_scaled,
        "total_internal": total_internal,
        "is_complete": is_complete,
    }


def compute_eligibility_from_cie(student_id: str, subject_id: str, session_id: str) -> Dict[str, Any]:
    """
    Determine SEE eligibility based on attendance + CIE aggregate.
    Uses the StudentEligibility record for attendance data.
    """
    from eligibility.models import StudentEligibility
    from .models import CIEConfiguration

    aggregate = compute_cie_aggregate(student_id, subject_id, session_id)
    if "error" in aggregate:
        return aggregate

    # Fetch attendance from eligibility record
    attendance = None
    try:
        elig = StudentEligibility.objects.get(
            student_id=student_id,
            subject_id=subject_id,
            exam_session_id=session_id,
        )
        attendance = float(elig.attendance_percentage or 0)
    except StudentEligibility.DoesNotExist:
        attendance = None

    # Eligibility rules
    attendance_ok = attendance is not None and attendance >= 75
    attendance_condonable = attendance is not None and 65 <= attendance < 75
    cie_ok = aggregate.get('cie_average') is not None and aggregate['cie_average'] >= 35  # 70% of 50

    is_eligible = attendance_ok and cie_ok
    is_condonable = attendance_condonable and cie_ok
    is_detained = not is_eligible and not is_condonable

    return {
        **aggregate,
        "attendance_percentage": attendance,
        "is_eligible": is_eligible,
        "is_condonable": is_condonable,
        "is_detained": is_detained,
        "remarks": " | ".join(filter(None, [
            f"Attendance: {attendance}%" if attendance is not None else "Attendance: Not recorded",
            f"CIE avg: {aggregate.get('cie_average')}/ 50" if aggregate.get('cie_average') is not None else "CIE: Incomplete",
        ])),
    }
