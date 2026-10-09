import pytest
from datetime import date, time

from django.utils import timezone

from users.models import Department, Student, User
from scheduling.models import ExamSession, Room, Subject, TimetableSlot, archive_slots
from student.models import Result, SEEAnswer, SEEAttempt
from cie.models import CIEAnswer, CIEAttempt, CIEConfiguration
from vault.models import Question, QuestionPaper


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name="CS", code="CS")
    coordinator = User.objects.create_user(
        email="coord@test.com", password="pwd", full_name="Coordinator",
        role="FACULTY", department=dept,
    )
    student_user = User.objects.create_user(
        email="stud@test.com", password="pwd", full_name="Test Student",
        role="STUDENT", department=dept,
    )
    student = Student.objects.create(
        user=student_user, department=dept, usn="4MC23CS999",
        current_semester=5, batch_year=2025,
    )
    other_user = User.objects.create_user(
        email="stud2@test.com", password="pwd", full_name="Other Student",
        role="STUDENT", department=dept,
    )
    other_student = Student.objects.create(
        user=other_user, department=dept, usn="4MC23CS998",
        current_semester=5, batch_year=2025,
    )

    subject = Subject.objects.create(
        code="CS901", name="Reschedule Subject", department=dept,
        semester=5, batch_year=2025, coordinator=coordinator,
    )
    other_subject = Subject.objects.create(
        code="CS902", name="Untouched Subject", department=dept,
        semester=5, batch_year=2025, coordinator=coordinator,
    )
    session = ExamSession.objects.create(
        name="SEE Test Session", session_type="SEE", semester=5,
        academic_year="2026-27",
        start_date=date(2026, 10, 1), end_date=date(2026, 11, 30),
    )
    cie_session = ExamSession.objects.create(
        name="CIE Test Session", session_type="CIE", semester=5,
        academic_year="2026-27",
        start_date=date(2026, 10, 1), end_date=date(2026, 11, 30),
    )
    room = Room.objects.create(
        name="CRB-9", building="CRB", total_capacity=60, exam_capacity=30,
    )

    slot = TimetableSlot.objects.create(
        exam_session=session, subject=subject, room=room,
        exam_date=date(2026, 10, 9), start_time=time(14, 0), end_time=time(17, 0),
        seat_map={},
    )
    untouched_slot = TimetableSlot.objects.create(
        exam_session=session, subject=other_subject, room=room,
        exam_date=date(2026, 10, 13), start_time=time(14, 0), end_time=time(17, 0),
        seat_map={},
    )

    paper = QuestionPaper.objects.create(
        title="RS SEE", subject=subject, exam_session=session, setter=coordinator,
    )
    question = Question.objects.create(
        question_paper=paper, section="A", question_number=1, part="a",
        text_content="Q?", marks=10, co_tag="CO1", bloom_level="REMEMBER",
    )

    attempt = SEEAttempt.objects.create(
        student=student, subject=subject, exam_session=session,
        is_locked=True, submitted_at=timezone.now(), proctor_strikes=2,
    )
    SEEAnswer.objects.create(attempt=attempt, question=question, answer_text="old")
    untouched_attempt = SEEAttempt.objects.create(
        student=other_student, subject=other_subject, exam_session=session,
        is_locked=True, submitted_at=timezone.now(),
    )
    result = Result.objects.create(
        student=student, subject=subject, exam_session=session,
        cie_marks=30, see_marks=73,
    )
    result.save()

    cie_config = CIEConfiguration.objects.create(
        subject=subject, exam_session=cie_session,
        cie_number=CIEConfiguration.CIENumber.CIE_1,
        scheduled_date=date(2026, 10, 5), scheduled_time=time(12, 0),
        is_active=True,
    )
    cie_slot = TimetableSlot.objects.create(
        exam_session=cie_session, subject=subject, room=room,
        exam_date=date(2026, 10, 5), start_time=time(12, 0), end_time=time(12, 30),
        seat_map={},
    )
    cie_attempt = CIEAttempt.objects.create(
        student=student, cie_config=cie_config,
        is_locked=True, submitted_at=timezone.now(),
        submission_status=CIEAttempt.SubmissionStatus.SUBMITTED,
        proctor_strikes=1,
    )
    CIEAnswer.objects.create(
        attempt=cie_attempt, question_text="Q1", answer_text="old cie",
    )

    return {
        "slot": slot,
        "untouched_slot": untouched_slot,
        "attempt": attempt,
        "untouched_attempt": untouched_attempt,
        "result": result,
        "cie_slot": cie_slot,
        "cie_attempt": cie_attempt,
    }


class TestRescheduleVoidsAttempts:
    def test_see_attempt_unlocked_and_answers_deleted(self, setup):
        archived = archive_slots(
            TimetableSlot.objects.filter(pk=setup["slot"].pk),
            reason="Exam rescheduled", user=None,
        )
        assert archived == 1

        attempt = SEEAttempt.objects.get(pk=setup["attempt"].pk)
        assert attempt.is_locked is False
        assert attempt.submitted_at is None
        assert attempt.proctor_strikes == 0
        assert attempt.answers.count() == 0

        setup["slot"].refresh_from_db()
        assert setup["slot"].status == TimetableSlot.SlotStatus.RESCHEDULED

    def test_result_see_marks_cleared(self, setup):
        archive_slots(
            TimetableSlot.objects.filter(pk=setup["slot"].pk),
            reason="Exam rescheduled", user=None,
        )
        result = Result.objects.get(pk=setup["result"].pk)
        assert result.see_marks is None
        assert result.see_converted_marks is None
        assert result.total_marks is None
        assert result.grade is None
        assert result.cie_marks == 30

    def test_other_subject_attempt_untouched(self, setup):
        archive_slots(
            TimetableSlot.objects.filter(pk=setup["slot"].pk),
            reason="Exam rescheduled", user=None,
        )
        other = SEEAttempt.objects.get(pk=setup["untouched_attempt"].pk)
        assert other.is_locked is True
        assert other.submitted_at is not None
        setup["untouched_slot"].refresh_from_db()
        assert setup["untouched_slot"].status != TimetableSlot.SlotStatus.RESCHEDULED

    def test_cie_attempt_reset(self, setup):
        archive_slots(
            TimetableSlot.objects.filter(pk=setup["cie_slot"].pk),
            reason="CIE rescheduled", user=None,
        )
        attempt = CIEAttempt.objects.get(pk=setup["cie_attempt"].pk)
        assert attempt.is_locked is False
        assert attempt.submitted_at is None
        assert attempt.submission_status == CIEAttempt.SubmissionStatus.IN_PROGRESS
        assert attempt.proctor_strikes == 0
        assert attempt.answers.count() == 0

    def test_already_archived_slot_is_noop(self, setup):
        archive_slots(
            TimetableSlot.objects.filter(pk=setup["slot"].pk),
            reason="first", user=None,
        )
        attempt = SEEAttempt.objects.get(pk=setup["attempt"].pk)
        assert attempt.is_locked is False

        archived = archive_slots(
            TimetableSlot.objects.filter(pk=setup["slot"].pk),
            reason="second", user=None,
        )
        assert archived == 0
        assert attempt.answers.count() == 0
