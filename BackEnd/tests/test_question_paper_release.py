"""Digital exam question-paper release tests.

Covers the exam-kiosk paper flow end to end at the API level:
- the student 404 regression (role-scoped viewset queryset)
- entitlement: students only receive the paper for their current exam
- any created paper is released regardless of schedule/paper creation order;
  only REJECTED papers are refused
- normalised sub-question payload Q1(a)/Q1(b) with individual marks
- schedule links every created paper (never rejected ones)
- part-aware answer binding for draft auto-save and final submit
"""
from datetime import date, time, timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from cie.models import CIEAnswer, CIEAttempt, CIEConfiguration
from eligibility.models import HallTicket
from scheduling.models import (
    ExamSession,
    Room,
    StudentSubjectEnrollment,
    Subject,
    TimetableSlot,
)
from student.models import SEEAnswer, SEEAttempt
from users.models import Department, Student, User
from vault.models import Question, QuestionPaper

SEE_SAVE_URL = "/api/v1/student/portal/see_save_answer/"
SEE_SUBMIT_URL = "/api/v1/student/portal/see_submit/"
HALL_TICKETS_URL = "/api/v1/student/portal/my_hall_tickets/"
CIE_SAVE_URL = "/api/v1/cie/test/kiosk_save_answer/"
CIE_SUBMIT_URL = "/api/v1/cie/test/kiosk_submit/"


def _release_url(paper):
    return f"/api/v1/vault/question-papers/{paper.id}/time_release/"


def _lock_url(paper):
    return f"/api/v1/vault/question-papers/{paper.id}/lock_and_submit/"


def _approve_url(paper):
    return f"/api/v1/vault/question-papers/{paper.id}/approve/"


def _set_status(paper, new_status):
    paper.status = new_status
    paper.save(update_fields=["status"])


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name="CS", code="CS")

    stu_user = User.objects.create_user(
        email="s1@test.com", password="pwd", full_name="S One",
        role="STUDENT", department=dept,
    )
    student = Student.objects.create(
        user=stu_user, department=dept, usn="1RV25CS001",
        current_semester=5, batch_year=2025,
    )
    other_user = User.objects.create_user(
        email="s2@test.com", password="pwd", full_name="S Two",
        role="STUDENT", department=dept,
    )
    other_student = Student.objects.create(
        user=other_user, department=dept, usn="1RV25CS002",
        current_semester=5, batch_year=2025,
    )
    setter = User.objects.create_user(
        email="setter@test.com", password="pwd", full_name="Setter",
        role="PAPER_SETTER", department=dept,
    )
    coe = User.objects.create_user(
        email="coe@test.com", password="pwd", full_name="CoE",
        role="CHIEF_SUPERINTENDENT", department=dept,
    )

    subject = Subject.objects.create(
        code="CS501", name="Operating Systems",
        department=dept, semester=5, batch_year=2025,
    )
    session = ExamSession.objects.create(
        name="SEE November 2026", session_type="SEE",
        semester=5, academic_year="2026",
        start_date=date(2026, 9, 1), end_date=date(2026, 12, 1),
    )
    room = Room.objects.create(
        name="CRB-9", building="CRB", total_capacity=60, exam_capacity=30,
    )

    today = timezone.localdate()
    slot = TimetableSlot.objects.create(
        exam_session=session,
        subject=subject,
        room=room,
        exam_date=today,
        start_time=time(0, 0),
        end_time=time(3, 0),
        seat_map={"1RV25CS001": "R1-S1"},
        status="CONFIRMED",
    )
    StudentSubjectEnrollment.objects.create(
        student=student, subject=subject, exam_session=session,
    )
    HallTicket.objects.create(student=student, exam_session=session)

    paper = QuestionPaper.objects.create(
        subject=subject,
        exam_session=session,
        setter=setter,
        title="OS SEE Paper",
        total_marks=100,
        duration_mins=120,
        status="DRAFT",
        instructions="Answer all questions.",
    )
    Question.objects.create(
        question_paper=paper, section="Part A", question_number=1, part="a",
        text_content="Define process.", marks=5, co_tag="CO1",
        bloom_level="REMEMBER",
    )
    Question.objects.create(
        question_paper=paper, section="Part A", question_number=1, part="b",
        text_content="Explain scheduling.", marks=5, co_tag="CO1",
        bloom_level="UNDERSTAND",
    )
    Question.objects.create(
        question_paper=paper, section="Part B", question_number=2, part="",
        text_content="Write short notes.", marks=10, co_tag="CO2",
        bloom_level="UNDERSTAND",
    )

    return {
        "dept": dept,
        "stu_user": stu_user,
        "student": student,
        "other_user": other_user,
        "other_student": other_student,
        "setter": setter,
        "coe": coe,
        "subject": subject,
        "session": session,
        "room": room,
        "slot": slot,
        "paper": paper,
        "today": today,
    }


def _sample_answers():
    return [
        {
            "question_number": 1, "part": "a",
            "question_text": "Define process.",
            "answer_text": "answer a", "answer_image_base64": "",
        },
        {
            "question_number": 1, "part": "b",
            "question_text": "Explain scheduling.",
            "answer_text": "answer b", "answer_image_base64": "",
        },
    ]


@pytest.mark.django_db
class TestTimeRelease:
    def test_student_receives_paper_despite_role_scoped_queryset(self, api_client, setup):
        """Regression: students used to 404 because get_queryset() excluded them."""
        paper = setup["paper"]
        _set_status(paper, QuestionPaper.PaperStatus.ENCRYPTED)

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(paper))

        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data["status"] == "unlocked"
        assert data["duration_mins"] == 120
        # total marks come from the real questions, not the model's 100 default
        assert data["total_marks"] == 20
        assert data["subject_code"] == "CS501"
        assert data["instructions"] == "Answer all questions."
        assert data["exam_session_name"] == "SEE November 2026"

        questions = data["content"]["questions"]
        assert len(questions) == 2

        q1 = questions[0]
        assert q1["questionNumber"] == 1
        assert q1["marks"] == 10
        subs = q1["subQuestions"]
        assert [s["label"] for s in subs] == ["Q1(a)", "Q1(b)"]
        assert [s["part"] for s in subs] == ["a", "b"]
        assert [s["marks"] for s in subs] == [5, 5]
        assert subs[0]["questionText"] == "Define process."
        assert subs[1]["questionText"] == "Explain scheduling."

        q2 = questions[1]
        assert q2["questionNumber"] == 2
        assert q2["marks"] == 10
        assert q2["questionText"] == "Write short notes."
        assert q2["subQuestions"] == []

    def test_rejected_paper_is_not_released(self, api_client, setup):
        _set_status(setup["paper"], QuestionPaper.PaperStatus.REJECTED)

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "not approved" in res.data["error"]

    def test_created_draft_paper_is_released_with_real_questions(self, api_client, setup):
        """Any created paper reaches the student - creation order is free."""
        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["content"]["questions"]) == 2

    def test_paper_without_any_timetable_slot_is_still_released(self, api_client, setup):
        """Schedule created after the paper (or not at all) must not hide it."""
        TimetableSlot.objects.all().delete()
        _set_status(setup["paper"], QuestionPaper.PaperStatus.ENCRYPTED)

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["content"]["questions"]) == 2

    def test_submitted_finalized_paper_is_released(self, api_client, setup):
        """Locked papers awaiting approval are finalized → students receive them."""
        _set_status(setup["paper"], QuestionPaper.PaperStatus.SUBMITTED)

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["content"]["questions"]) == 2

    def test_student_without_hall_ticket_is_forbidden(self, api_client, setup):
        _set_status(setup["paper"], QuestionPaper.PaperStatus.ENCRYPTED)

        api_client.force_authenticate(user=setup["other_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "not eligible" in res.data["error"]

    def test_student_not_seated_in_hall_is_forbidden(self, api_client, setup):
        # Seats are allotted but this student holds none of them.
        HallTicket.objects.create(
            student=setup["other_student"], exam_session=setup["session"],
        )
        _set_status(setup["paper"], QuestionPaper.PaperStatus.ENCRYPTED)

        api_client.force_authenticate(user=setup["other_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "not eligible" in res.data["error"]

    def test_too_early_returns_countdown(self, api_client, setup):
        _set_status(setup["paper"], QuestionPaper.PaperStatus.ENCRYPTED)
        slot = setup["slot"]
        slot.exam_date = setup["today"] + timedelta(days=1)
        slot.save(update_fields=["exam_date"])

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(setup["paper"]))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["remaining_seconds"] > 0

    def test_encrypted_paper_with_missing_vault_blob_falls_back_to_db(self, api_client, setup):
        paper = setup["paper"]
        paper.status = QuestionPaper.PaperStatus.ENCRYPTED
        paper.ipfs_cid = "QmDoesNotExistAnywhere"
        paper.encrypted_aes_key = None
        paper.save(update_fields=["status", "ipfs_cid", "encrypted_aes_key"])

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(paper))

        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["content"]["questions"]) == 2

    def test_full_flow_lock_approve_then_student_release(self, api_client, setup):
        """Setter locks → CoE approves → student receives decrypted content."""
        paper = setup["paper"]

        api_client.force_authenticate(user=setup["setter"])
        res = api_client.post(
            _lock_url(paper),
            {"key_unlock_timestamp": (timezone.now() - timedelta(minutes=5)).isoformat()},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

        api_client.force_authenticate(user=setup["coe"])
        res = api_client.post(_approve_url(paper))
        assert res.status_code == status.HTTP_200_OK
        paper.refresh_from_db()
        assert paper.status == QuestionPaper.PaperStatus.ENCRYPTED

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(_release_url(paper))
        assert res.status_code == status.HTTP_200_OK

        questions = res.data["content"]["questions"]
        assert len(questions) == 2
        assert [s["label"] for s in questions[0]["subQuestions"]] == ["Q1(a)", "Q1(b)"]
        assert res.data["total_marks"] == 20


@pytest.mark.django_db
class TestScheduleLinksPapers:
    def test_schedule_links_any_created_paper_but_never_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.get(HALL_TICKETS_URL)
        assert res.status_code == status.HTTP_200_OK

        ticket = next(
            t for t in res.data
            if str(t["exam_session_details"]["id"]) == str(setup["session"].id)
        )
        row = next(
            s for s in ticket["slots"] if s["subject_code"] == "CS501"
        )
        # DRAFT paper -> linked, so the student can attend as soon as it exists
        assert row["question_paper_id"] == str(setup["paper"].id)

        _set_status(setup["paper"], QuestionPaper.PaperStatus.REJECTED)
        res = api_client.get(HALL_TICKETS_URL)
        ticket = next(
            t for t in res.data
            if str(t["exam_session_details"]["id"]) == str(setup["session"].id)
        )
        row = next(
            s for s in ticket["slots"] if s["subject_code"] == "CS501"
        )
        assert row["question_paper_id"] is None

        _set_status(setup["paper"], QuestionPaper.PaperStatus.ENCRYPTED)
        res = api_client.get(HALL_TICKETS_URL)
        ticket = next(
            t for t in res.data
            if str(t["exam_session_details"]["id"]) == str(setup["session"].id)
        )
        row = next(
            s for s in ticket["slots"] if s["subject_code"] == "CS501"
        )
        assert row["question_paper_id"] == str(setup["paper"].id)


@pytest.mark.django_db
class TestAnswerPersistence:
    def test_auto_save_binds_sub_question_answers_and_submit(self, api_client, setup):
        api_client.force_authenticate(user=setup["stu_user"])

        res = api_client.post(
            SEE_SAVE_URL,
            {"subject_code": "CS501", "answers": _sample_answers()},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["saved"] == 2

        attempt = SEEAttempt.objects.get(
            student=setup["student"], subject=setup["subject"],
            exam_session=setup["session"],
        )
        assert attempt.is_locked is False

        rows = {
            ans.question.part: ans.answer_text
            for ans in SEEAnswer.objects.filter(attempt=attempt)
        }
        assert rows == {"a": "answer a", "b": "answer b"}

        # A later draft that omits the image must not wipe the stored one.
        with_image = [
            dict(_sample_answers()[0], answer_image_base64="img-bytes"),
        ]
        res = api_client.post(
            SEE_SAVE_URL,
            {"subject_code": "CS501", "answers": with_image},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        res = api_client.post(
            SEE_SAVE_URL,
            {"subject_code": "CS501", "answers": _sample_answers()[:1]},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        answer_a = SEEAnswer.objects.get(attempt=attempt, question__part="a")
        assert answer_a.answer_image_base64 == "img-bytes"

        # Final submit locks the attempt and keeps both sub-answers intact.
        res = api_client.post(
            SEE_SUBMIT_URL,
            {"subject_code": "CS501", "answers": _sample_answers(), "strike_count": 1},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["answers_stored"] == 2

        attempt.refresh_from_db()
        assert attempt.is_locked is True
        assert attempt.proctor_strikes == 1
        assert SEEAnswer.objects.filter(attempt=attempt).count() == 2
        rows = {
            ans.question.part: ans.answer_text
            for ans in SEEAnswer.objects.filter(attempt=attempt)
        }
        assert rows == {"a": "answer a", "b": "answer b"}

        # Locked attempt refuses further drafts.
        res = api_client.post(
            SEE_SAVE_URL,
            {"subject_code": "CS501", "answers": _sample_answers()[:1]},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_cie_auto_save_and_submit_keep_sub_answers_separate(self, api_client, setup):
        cie_session = ExamSession.objects.create(
            name="CIE-1 Fall 2026", session_type="CIE",
            semester=5, academic_year="2026",
            start_date=date(2026, 9, 1), end_date=date(2026, 12, 1),
        )
        config = CIEConfiguration.objects.create(
            subject=setup["subject"],
            exam_session=cie_session,
            is_active=True,
            scheduled_date=setup["today"],
            scheduled_time=time(10, 0),
        )

        api_client.force_authenticate(user=setup["stu_user"])
        res = api_client.post(
            CIE_SAVE_URL,
            {"subject_code": "CS501", "answers": _sample_answers()},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["saved"] == 2

        attempt = CIEAttempt.objects.get(
            student=setup["student"], cie_config=config,
        )
        assert attempt.is_locked is False
        assert CIEAnswer.objects.filter(attempt=attempt).count() == 2
        keys = set(
            CIEAnswer.objects.filter(attempt=attempt)
            .values_list("question_text", flat=True)
        )
        assert any(k.startswith("Q1(a)") for k in keys)
        assert any(k.startswith("Q1(b)") for k in keys)

        # Final submit uses the same keys → no duplicates, no overwrite.
        res = api_client.post(
            CIE_SUBMIT_URL,
            {"subject_code": "CS501", "answers": _sample_answers(), "strike_count": 0},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        attempt.refresh_from_db()
        assert attempt.is_locked is True
        assert CIEAnswer.objects.filter(attempt=attempt).count() == 2
        texts = dict(
            CIEAnswer.objects.filter(attempt=attempt)
            .values_list("question_text", "answer_text")
        )
        assert len(texts) == 2
        assert any(k.startswith("Q1(a)") for k in texts)
        assert any(k.startswith("Q1(b)") for k in texts)
        assert set(texts.values()) == {"answer a", "answer b"}
