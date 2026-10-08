"""
SEE valuation flow tests — submission listing, grading, distribution to an
evaluator, Result materialization, and CoE publication.

Mirrors the CIE grading tests' structure; every endpoint exercised here is:
  GET  /student/see/submissions/       (faculty/evaluator)
  POST /student/see/grade_answer/      (faculty/evaluator)
  GET  /student/see/evaluators/        (distribution pick list)
  POST /evaluation/bundles/            (distribution)
  GET  /evaluation/bundles/            (evaluator work list)
  POST /evaluation/results/publish_results/  (CoE publication)
  GET  /student/portal/my_results/     (student ledger)
"""
import pytest
from datetime import date

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User, Department, Student
from scheduling.models import Subject, ExamSession, StudentSubjectEnrollment
from vault.models import QuestionPaper, Question
from student.models import Result, SEEAttempt, SEEAnswer
from evaluation.models import EvaluationBundle
from eligibility.models import StudentEligibility


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name="CS", code="CS")

    coordinator = User.objects.create_user(
        email="coord@test.com", password="pwd", full_name="Coordinator",
        role="FACULTY", department=dept,
    )
    other_faculty = User.objects.create_user(
        email="other@test.com", password="pwd", full_name="Other Faculty",
        role="FACULTY", department=dept,
    )
    evaluator = User.objects.create_user(
        email="eval@test.com", password="pwd", full_name="Evaluator One",
        role="EVALUATOR", department=dept,
    )
    coe = User.objects.create_user(
        email="coe@test.com", password="pwd", full_name="Controller",
        role="CHIEF_SUPERINTENDENT",
    )
    student_user = User.objects.create_user(
        email="stud@test.com", password="pwd", full_name="Test Student",
        role="STUDENT", department=dept,
    )
    student = Student.objects.create(
        user=student_user, department=dept, usn="4MC23CS999",
        current_semester=5, batch_year=2025,
    )

    subject = Subject.objects.create(
        code="CS302", name="Data Science", department=dept,
        semester=5, batch_year=2025, coordinator=coordinator,
    )
    session = ExamSession.objects.create(
        name="SEE November 2026", session_type="SEE", semester=5,
        academic_year="2026-27",
        start_date=date(2026, 10, 1), end_date=date(2026, 11, 30),
    )
    StudentSubjectEnrollment.objects.create(
        student=student, subject=subject, exam_session=session,
    )

    paper = QuestionPaper.objects.create(
        title="DS SEE", subject=subject, exam_session=session, setter=coordinator,
    )
    q1 = Question.objects.create(
        question_paper=paper, section="A", question_number=1, part="a",
        text_content="What is Data Science?", marks=10,
        co_tag="CO1", bloom_level="REMEMBER",
    )
    q2 = Question.objects.create(
        question_paper=paper, section="A", question_number=1, part="b",
        text_content="Explain ML.", marks=10,
        co_tag="CO2", bloom_level="UNDERSTAND",
    )

    attempt = SEEAttempt.objects.create(
        student=student, subject=subject, exam_session=session,
        is_locked=True, submitted_at=timezone.now(),
    )
    a1 = SEEAnswer.objects.create(attempt=attempt, question=q1, answer_text="DS is ...")
    a2 = SEEAnswer.objects.create(
        attempt=attempt, question=q2,
        answer_image_base64="data:image/png;base64,AAAA", extracted_text="ML is ...",
    )

    StudentEligibility.objects.create(
        student=student, subject=subject, exam_session=session,
        attendance_percentage=90.0, cie_marks=35.0, is_eligible=True,
    )

    return {
        "dept": dept,
        "coordinator": coordinator,
        "other_faculty": other_faculty,
        "evaluator": evaluator,
        "coe": coe,
        "student_user": student_user,
        "student": student,
        "subject": subject,
        "session": session,
        "attempt": attempt,
        "a1": a1,
        "a2": a2,
    }


def _submissions_url(setup, client, expect_status=status.HTTP_200_OK):
    url = f"{reverse('see-test-submissions')}?subject={setup['subject'].id}"
    resp = client.get(url)
    assert resp.status_code == expect_status, resp.data
    return resp


@pytest.mark.django_db
class TestSEESubmissions:
    def test_coordinator_lists_submissions_with_answers(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        resp = _submissions_url(setup, api_client)

        data = resp.data
        assert data["count"] == 1
        assert data["subject"]["code"] == "CS302"
        assert data["exam_session"]["name"] == "SEE November 2026"
        assert data["bundle"] is None

        sub = data["submissions"][0]
        assert sub["student_usn"] == "4MC23CS999"
        assert sub["answers_count"] == 2
        assert sub["graded_count"] == 0
        assert sub["fully_graded"] is False
        assert [a["question_label"] for a in sub["answers"]] == ["Q1(a)", "Q1(b)"]
        assert sub["answers"][1]["max_marks"] == 10
        assert sub["answers"][1]["answer_image_base64"].startswith("data:image")
        assert sub["answers"][1]["extracted_text"] == "ML is ..."
        assert sub["answers"][0]["marks_awarded"] is None

    def test_student_blocked(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        _submissions_url(setup, api_client, expect_status=status.HTTP_403_FORBIDDEN)

    def test_unassigned_faculty_blocked(self, api_client, setup):
        api_client.force_authenticate(user=setup["other_faculty"])
        _submissions_url(setup, api_client, expect_status=status.HTTP_403_FORBIDDEN)

    def test_missing_subject_param(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.get(reverse('see-test-submissions'))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_evaluator_without_bundle_blocked(self, api_client, setup):
        api_client.force_authenticate(user=setup["evaluator"])
        _submissions_url(setup, api_client, expect_status=status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestSEEGrading:
    def test_grade_answer_syncs_result_and_my_results(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        grade_url = reverse('see-test-grade-answer')

        r1 = api_client.post(
            grade_url,
            {"answer_id": str(setup["a1"].id), "marks_awarded": 6},
            format="json",
        )
        assert r1.status_code == status.HTTP_200_OK, r1.data
        assert r1.data["see_marks_total"] == 6.0

        r2 = api_client.post(
            grade_url,
            {"answer_id": str(setup["a2"].id), "marks_awarded": 8},
            format="json",
        )
        assert r2.status_code == status.HTTP_200_OK, r2.data
        assert r2.data["see_marks_total"] == 14.0

        # Auto-synced into Result immediately (mirrors CIE → CIEMarks)
        result = Result.objects.get(
            student=setup["student"], subject=setup["subject"],
            exam_session=setup["session"],
        )
        assert float(result.see_marks) == 14.0

# Student ledger: marks are hidden before CoE publishes; announcement shown instead.
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.get(reverse('studentportal-my-results'))
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1
        row = resp.data[0]
        # Marks are hidden before publication; announcement shown instead.
        assert row["cie_marks"] is None
        assert row["see_marks"] is None
        assert row["see_converted_marks"] is None
        assert row["total_marks"] is None
        assert row["grade"] is None
        assert row["is_published"] is False
        assert row["announcement"] == "Result Not Yet Announced"

    def test_my_results_syncs_graded_answers_without_grade_endpoint(
        self, api_client, setup
    ):
        # Marks set directly in the DB (no grade_answer call) — my_results
        # must still materialize the SEE total.
        for ans, marks in ((setup["a1"], 6), (setup["a2"], 8)):
            ans.marks_awarded = marks
            ans.save()
        assert not Result.objects.filter(student=setup["student"]).exists()

        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.get(reverse('studentportal-my-results'))
        assert resp.status_code == status.HTTP_200_OK
        # Marks are hidden before CoE publishes; announcement shown instead.
        assert resp.data[0]["see_marks"] is None
        assert resp.data[0]["cie_marks"] is None
        assert resp.data[0]["see_converted_marks"] is None
        assert resp.data[0]["total_marks"] is None
        assert resp.data[0]["grade"] is None
        assert resp.data[0]["is_published"] is False
        assert resp.data[0]["announcement"] == "Result Not Yet Announced"

    def test_grade_forbidden_for_unassigned_faculty(self, api_client, setup):
        api_client.force_authenticate(user=setup["other_faculty"])
        resp = api_client.post(
            reverse('see-test-grade-answer'),
            {"answer_id": str(setup["a1"].id), "marks_awarded": 6},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        setup["a1"].refresh_from_db()
        assert setup["a1"].marks_awarded is None

    def test_grade_forbidden_for_student(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.post(
            reverse('see-test-grade-answer'),
            {"answer_id": str(setup["a1"].id), "marks_awarded": 6},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_grade_validation(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        grade_url = reverse('see-test-grade-answer')

        resp = api_client.post(grade_url, {"answer_id": str(setup["a1"].id)}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        resp = api_client.post(
            grade_url,
            {"answer_id": str(setup["a1"].id), "marks_awarded": "abc"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        resp = api_client.post(
            grade_url,
            {"answer_id": str(setup["a1"].id), "marks_awarded": -5},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        resp = api_client.post(
            grade_url,
            {"answer_id": "00000000-0000-0000-0000-000000000000", "marks_awarded": 5},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestDistributionToEvaluator:
    def test_evaluators_picklist(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.get(reverse('see-test-evaluators'))
        assert resp.status_code == status.HTTP_200_OK
        names = [u["full_name"] for u in resp.data]
        assert "Evaluator One" in names
        assert "Coordinator" in names  # faculty can also be assigned
        assert "Test Student" not in names

        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.get(reverse('see-test-evaluators'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_bundle_create_grants_evaluator_access(self, api_client, setup):
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.post(
            reverse('evaluationbundle-list'),
            {
                "name": "SEE Valuation - CS302",
                "subject": str(setup["subject"].id),
                "exam_session": str(setup["session"].id),
                "evaluator": str(setup["evaluator"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        bundle = EvaluationBundle.objects.get(subject=setup["subject"])
        assert bundle.evaluator == setup["evaluator"]
        assert bundle.status == "ASSIGNED"

        # Evaluator now passes the submissions guard, sees the bundle info
        api_client.force_authenticate(user=setup["evaluator"])
        resp = _submissions_url(setup, api_client)
        assert resp.data["bundle"]["evaluator_name"] == "Evaluator One"
        assert resp.data["bundle"]["id"] == str(bundle.id)

        # Evaluator work list only shows their own bundles
        resp = api_client.get(reverse('evaluationbundle-list'))
        assert resp.status_code == status.HTTP_200_OK
        items = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        assert [b["id"] for b in items] == [str(bundle.id)]

        # Coordinator also sees bundles for their coordinated subject
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.get(reverse('evaluationbundle-list'))
        items = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        assert str(bundle.id) in [b["id"] for b in items]

        # Unassigned faculty still blocked from submissions
        api_client.force_authenticate(user=setup["other_faculty"])
        _submissions_url(setup, api_client, expect_status=status.HTTP_403_FORBIDDEN)

    def test_student_cannot_create_bundle(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.post(
            reverse('evaluationbundle-list'),
            {
                "name": "Sneaky",
                "subject": str(setup["subject"].id),
                "exam_session": str(setup["session"].id),
                "evaluator": str(setup["evaluator"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestPublishResults:
    def _grade_directly(self, setup, marks=(7, 9)):
        for ans, m in zip((setup["a1"], setup["a2"]), marks):
            ans.marks_awarded = m
            ans.save()

    def test_publish_graded_attempt_notifies_students(self, api_client, setup):
        self._grade_directly(setup)

        api_client.force_authenticate(user=setup["coe"])
        resp = api_client.post(
            reverse('resultpublish-publish-results'),
            {
                "exam_session_id": str(setup["session"].id),
                "subject_id": str(setup["subject"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["results_created"] == 1
        assert resp.data["results_updated"] == 0

        result = Result.objects.get(
            student=setup["student"], subject=setup["subject"],
            exam_session=setup["session"],
        )
        assert float(result.see_marks) == 16.0
        assert float(result.cie_marks) == 35.0
        assert float(result.total_marks) == 43.0    # 35 + (16×50/100)=35+8=43
        assert result.grade == "E"                 # 40-49 → E
        assert result.is_published is True
        assert result.see_converted_marks == 8.0

        from notifications.models import Notification
        assert Notification.objects.filter(
            recipient=setup["student_user"], notification_type="RESULT_PUBLISHED",
        ).exists()

    def test_ungraded_attempt_not_published(self, api_client, setup):
        api_client.force_authenticate(user=setup["coe"])
        resp = api_client.post(
            reverse('resultpublish-publish-results'),
            {
                "exam_session_id": str(setup["session"].id),
                "subject_id": str(setup["subject"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["results_created"] == 0
        assert resp.data["results_updated"] == 0
        assert not Result.objects.filter(student=setup["student"]).exists()

    def test_only_coe_can_publish(self, api_client, setup):
        self._grade_directly(setup)
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.post(
            reverse('resultpublish-publish-results'),
            {
                "exam_session_id": str(setup["session"].id),
                "subject_id": str(setup["subject"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
