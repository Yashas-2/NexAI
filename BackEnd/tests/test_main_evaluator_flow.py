"""
Main Evaluator / Bundle Custodian workflow tests.

Covers the real post-SEE pipeline:
  SEE Exam Completed → Answer Booklets Received → Main Evaluator
  → Create Bundles → Assign Evaluators → Evaluation
  → Marks Totaling & Verification → Certification
  → CoE Grade Ledger → Dispatch / Finalize

Endpoints exercised:
  GET  /evaluation/bundles/overview/
  POST /evaluation/bundles/create_from_attempts/
  POST /evaluation/bundles/<id>/assign_evaluator|start_evaluation|complete_evaluation|verify/
  GET  /evaluation/results/ledger/
  POST /evaluation/results/certify|dispatch/
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
    evaluator = User.objects.create_user(
        email="eval@test.com", password="pwd", full_name="Evaluator One",
        role="EVALUATOR", department=dept,
    )
    evaluator2 = User.objects.create_user(
        email="eval2@test.com", password="pwd", full_name="Evaluator Two",
        role="EVALUATOR", department=dept,
    )
    main_evaluator = User.objects.create_user(
        email="main@test.com", password="pwd", full_name="Main Evaluator",
        role="SCRUTINIZER", department=dept,
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
        "evaluator": evaluator,
        "evaluator2": evaluator2,
        "main_evaluator": main_evaluator,
        "coe": coe,
        "student_user": student_user,
        "student": student,
        "subject": subject,
        "session": session,
        "paper": paper,
        "attempt": attempt,
        "a1": a1,
        "a2": a2,
    }


def _extra_attempt(setup, usn):
    """Another locked booklet for the same subject/session (bundle splitting)."""
    user = User.objects.create_user(
        email=f"{usn}@test.com", password="pwd", full_name=f"Student {usn}",
        role="STUDENT", department=setup["dept"],
    )
    student = Student.objects.create(
        user=user, department=setup["dept"], usn=usn,
        current_semester=5, batch_year=2025,
    )
    StudentSubjectEnrollment.objects.create(
        student=student, subject=setup["subject"], exam_session=setup["session"],
    )
    attempt = SEEAttempt.objects.create(
        student=student, subject=setup["subject"], exam_session=setup["session"],
        is_locked=True, submitted_at=timezone.now(),
    )
    for q in Question.objects.filter(question_paper=setup["paper"]):
        SEEAnswer.objects.create(attempt=attempt, question=q, answer_text="ans")
    return attempt


def _grade_all(setup, marks=(6, 8)):
    for ans, m in zip((setup["a1"], setup["a2"]), marks):
        ans.marks_awarded = m
        ans.save()


def _make_bundle(setup, client):
    """Main Evaluator creates Bundle #001 filing the fixture booklet."""
    client.force_authenticate(user=setup["main_evaluator"])
    resp = client.post(
        reverse("evaluationbundle-create-from-attempts"),
        {
            "subject_id": str(setup["subject"].id),
            "exam_session_id": str(setup["session"].id),
            "bundle_size": 25,
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.data
    return EvaluationBundle.objects.get(name__startswith="Bundle #001")


def _lifecycle_to_verified(setup, client, bundle):
    """assign → redeem → start → grade → complete → verify (status ends VERIFIED)."""
    client.force_authenticate(user=setup["main_evaluator"])
    resp = client.post(
        reverse("evaluationbundle-assign-evaluator", kwargs={"pk": bundle.id}),
        {"evaluator_id": str(setup["evaluator"].id)},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    # Redeem the secure access code so the evaluator can see/start the bundle.
    code = resp.data["access_code"]
    client.force_authenticate(user=setup["evaluator"])
    client.post(
        reverse("evaluationbundle-redeem"),
        {"code": code},
        format="json",
    )

    client.force_authenticate(user=setup["evaluator"])
    resp = client.post(
        reverse("evaluationbundle-start-evaluation", kwargs={"pk": bundle.id}),
        {}, format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data

    _grade_all(setup)

    resp = client.post(
        reverse("evaluationbundle-complete-evaluation", kwargs={"pk": bundle.id}),
        {}, format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data

    client.force_authenticate(user=setup["main_evaluator"])
    resp = client.post(
        reverse("evaluationbundle-verify", kwargs={"pk": bundle.id}),
        {}, format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    bundle.refresh_from_db()
    assert bundle.status == "VERIFIED"


@pytest.mark.django_db
class TestMainEvaluatorOverview:
    def test_overview_returns_real_intake_stats(self, api_client, setup):
        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.get(reverse("evaluationbundle-overview"))
        assert resp.status_code == status.HTTP_200_OK, resp.data

        stats = resp.data["stats"]
        assert stats["booklets_received"] == 1
        assert stats["booklets_unbundled"] == 1
        assert stats["bundles_created"] == 0
        assert stats["bundles_assigned"] == 0
        assert stats["awaiting_evaluation"] == 0
        assert stats["awaiting_verification"] == 0
        assert stats["certified"] == 0
        assert stats["dispatched"] == 0

        rows = resp.data["subjects"]
        assert len(rows) == 1
        assert rows[0]["subject_code"] == "CS302"
        assert rows[0]["exam_session_name"] == "SEE November 2026"
        assert rows[0]["received"] == 1
        assert rows[0]["unbundled"] == 1
        assert rows[0]["bundles"] == 0
        assert rows[0]["total_answers"] == 2
        assert rows[0]["graded_answers"] == 0

        emails = [e["email"] for e in resp.data["evaluators"]]
        assert "eval@test.com" in emails
        assert "stud@test.com" not in emails

    def test_overview_reflects_bundle_lifecycle(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        _lifecycle_to_verified(setup, api_client, bundle)

        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.get(reverse("evaluationbundle-overview"))
        stats = resp.data["stats"]
        assert stats["booklets_received"] == 1
        assert stats["booklets_unbundled"] == 0
        assert stats["bundles_created"] == 1
        assert stats["bundles_assigned"] == 1
        assert stats["evaluators_active"] == 1
        assert stats["awaiting_evaluation"] == 0
        assert stats["awaiting_verification"] == 0
        assert stats["awaiting_certification"] == 1

        row = resp.data["subjects"][0]
        assert row["bundles"] == 1
        assert row["unbundled"] == 0
        assert row["graded_answers"] == 2

        eval_row = next(e for e in resp.data["evaluators"] if e["email"] == "eval@test.com")
        assert eval_row["active_bundles"] == 1

    def test_student_blocked_from_overview(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.get(reverse("evaluationbundle-overview"))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestBundleIntake:
    def test_create_from_attempts_files_booklets(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        assert bundle.name.startswith("Bundle #001")
        assert bundle.status == "CREATED"
        assert bundle.evaluator is None

        setup["attempt"].refresh_from_db()
        assert setup["attempt"].evaluation_bundle == bundle

    def test_create_from_attempts_splits_by_size(self, api_client, setup):
        _extra_attempt(setup, "4MC23CS001")
        _extra_attempt(setup, "4MC23CS002")

        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-create-from-attempts"),
            {
                "subject_id": str(setup["subject"].id),
                "exam_session_id": str(setup["session"].id),
                "bundle_size": 2,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["bundles_created"] == 2
        assert resp.data["booklets_bundled"] == 3

        bundles = EvaluationBundle.objects.filter(subject=setup["subject"]).order_by("name")
        assert [b.name.split(" -")[0] for b in bundles] == ["Bundle #001", "Bundle #002"]
        counts = sorted(b.see_attempts.count() for b in bundles)
        assert counts == [1, 2]

        # Numbering continues from existing bundles on a second run
        resp = api_client.post(
            reverse("evaluationbundle-create-from-attempts"),
            {
                "subject_id": str(setup["subject"].id),
                "exam_session_id": str(setup["session"].id),
                "bundle_size": 10,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST  # nothing left

    def test_create_from_attempts_validation(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.post(
            reverse("evaluationbundle-create-from-attempts"),
            {
                "subject_id": str(setup["subject"].id),
                "exam_session_id": str(setup["session"].id),
                "bundle_size": 5,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-create-from-attempts"),
            {
                "subject_id": str(setup["subject"].id),
                "exam_session_id": str(setup["session"].id),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST  # bundle_size missing

        resp = api_client.post(
            reverse("evaluationbundle-create-from-attempts"),
            {
                "subject_id": str(setup["subject"].id),
                "exam_session_id": str(setup["session"].id),
                "bundle_size": 0,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_evaluator_only_sees_own_bundles(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        api_client.force_authenticate(user=setup["main_evaluator"])
        api_client.post(
            reverse("evaluationbundle-assign-evaluator", kwargs={"pk": bundle.id}),
            {"evaluator_id": str(setup["evaluator"].id)},
            format="json",
        )

        api_client.force_authenticate(user=setup["evaluator2"])
        resp = api_client.get(reverse("evaluationbundle-list"))
        items = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        assert items == []

        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.get(reverse("evaluationbundle-list"))
        items = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        assert [b["id"] for b in items] == [str(bundle.id)]

    def test_assign_rejects_non_evaluator_role(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-assign-evaluator", kwargs={"pk": bundle.id}),
            {"evaluator_id": str(setup["student_user"].id)},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        bundle.refresh_from_db()
        assert bundle.evaluator is None
        assert bundle.status == "CREATED"


@pytest.mark.django_db
class TestBundleLifecycle:
    def test_full_lifecycle_to_verified(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)

        # Cannot start before an evaluator is assigned (unassigned bundles
        # are not even visible to evaluators → 404, or 400 if visible)
        api_client.force_authenticate(user=setup["evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-start-evaluation", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND)
        bundle.refresh_from_db()
        assert bundle.status == "CREATED"

        _lifecycle_to_verified(setup, api_client, bundle)

    def test_complete_blocked_while_answers_ungraded(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)

        api_client.force_authenticate(user=setup["main_evaluator"])
        api_client.post(
            reverse("evaluationbundle-assign-evaluator", kwargs={"pk": bundle.id}),
            {"evaluator_id": str(setup["evaluator"].id)},
            format="json",
        )
        api_client.force_authenticate(user=setup["evaluator"])
        api_client.post(
            reverse("evaluationbundle-start-evaluation", kwargs={"pk": bundle.id}),
            {}, format="json",
        )

        # One of two answers graded → cannot complete
        setup["a1"].marks_awarded = 6
        setup["a1"].save()
        resp = api_client.post(
            reverse("evaluationbundle-complete-evaluation", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "ungraded" in resp.data["error"]

        bundle.refresh_from_db()
        assert bundle.status == "IN_PROGRESS"

        # Grade the rest → completes
        setup["a2"].marks_awarded = 8
        setup["a2"].save()
        resp = api_client.post(
            reverse("evaluationbundle-complete-evaluation", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        bundle.refresh_from_db()
        assert bundle.status == "COMPLETED"

    def test_verify_requires_completed_and_main_evaluator_role(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)

        # Cannot verify a freshly created bundle
        api_client.force_authenticate(user=setup["main_evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-verify", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        _lifecycle_to_verified(setup, api_client, bundle)

        # Evaluator cannot verify their own bundle
        api_client.force_authenticate(user=setup["evaluator"])
        resp = api_client.post(
            reverse("evaluationbundle-verify", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_other_evaluator_cannot_touch_bundle(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        _lifecycle_to_verified(setup, api_client, bundle)

        api_client.force_authenticate(user=setup["evaluator2"])
        resp = api_client.post(
            reverse("evaluationbundle-verify", kwargs={"pk": bundle.id}),
            {}, format="json",
        )
        assert resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        bundle.refresh_from_db()
        assert bundle.status == "VERIFIED"


@pytest.mark.django_db
class TestCertifyLedgerDispatch:
    def test_ledger_locked_until_certified(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        _lifecycle_to_verified(setup, api_client, bundle)

        url = (
            f"{reverse('resultpublish-ledger')}"
            f"?subject={setup['subject'].id}&exam_session={setup['session'].id}"
        )
        api_client.force_authenticate(user=setup["coe"])
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["certified"] is False
        assert resp.data["results_locked"] is True
        assert resp.data["results"] == []
        assert resp.data["status_counts"] == {"VERIFIED": 1}
        assert resp.data["bundles"][0]["name"].startswith("Bundle #001")

    def test_certify_requires_verified_bundles(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        payload = {
            "subject_id": str(setup["subject"].id),
            "exam_session_id": str(setup["session"].id),
        }

        api_client.force_authenticate(user=setup["coe"])
        resp = api_client.post(reverse("resultpublish-certify"), payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST  # still CREATED

        _lifecycle_to_verified(setup, api_client, bundle)

        # Coordinator (FACULTY) cannot certify
        api_client.force_authenticate(user=setup["coordinator"])
        resp = api_client.post(reverse("resultpublish-certify"), payload, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(user=setup["coe"])
        resp = api_client.post(reverse("resultpublish-certify"), payload, format="json")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["certified"] == 1
        bundle.refresh_from_db()
        assert bundle.status == "CERTIFIED"

    def test_ledger_shows_results_once_certified(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        _lifecycle_to_verified(setup, api_client, bundle)
        payload = {
            "subject_id": str(setup["subject"].id),
            "exam_session_id": str(setup["session"].id),
        }
        api_client.force_authenticate(user=setup["coe"])
        api_client.post(reverse("resultpublish-certify"), payload, format="json")

        url = (
            f"{reverse('resultpublish-ledger')}"
            f"?subject={setup['subject'].id}&exam_session={setup['session'].id}"
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["certified"] is True
        assert resp.data["results_locked"] is False
        assert len(resp.data["results"]) == 1
        row = resp.data["results"][0]
        assert row["usn"] == "4MC23CS999"
        assert row["see_marks"] == 14.0
        assert row["grade"] == "E"  # 35 CIE + 14 SEE = 49

    def test_dispatch_finalizes_and_notifies(self, api_client, setup):
        bundle = _make_bundle(setup, api_client)
        _lifecycle_to_verified(setup, api_client, bundle)
        payload = {
            "subject_id": str(setup["subject"].id),
            "exam_session_id": str(setup["session"].id),
        }

        api_client.force_authenticate(user=setup["coe"])
        # Dispatch before certification → blocked
        resp = api_client.post(reverse("resultpublish-dispatch"), payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        api_client.post(reverse("resultpublish-certify"), payload, format="json")
        resp = api_client.post(reverse("resultpublish-dispatch"), payload, format="json")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["bundles_dispatched"] == 1
        assert resp.data["results_created"] + resp.data["results_updated"] == 1

        bundle.refresh_from_db()
        assert bundle.status == "DISPATCHED"

        result = Result.objects.get(
            student=setup["student"], subject=setup["subject"],
            exam_session=setup["session"],
        )
        assert float(result.see_marks) == 14.0
        assert result.grade == "E"

        from notifications.models import Notification
        assert Notification.objects.filter(
            recipient=setup["student_user"], notification_type="RESULT_PUBLISHED",
        ).exists()

        url = (
            f"{reverse('resultpublish-ledger')}"
            f"?subject={setup['subject'].id}&exam_session={setup['session'].id}"
        )
        resp = api_client.get(url)
        assert resp.data["dispatched"] is True
        assert resp.data["results_locked"] is False

    def test_student_blocked_from_ledger(self, api_client, setup):
        api_client.force_authenticate(user=setup["student_user"])
        resp = api_client.get(
            f"{reverse('resultpublish-ledger')}"
            f"?subject={setup['subject'].id}&exam_session={setup['session'].id}"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
