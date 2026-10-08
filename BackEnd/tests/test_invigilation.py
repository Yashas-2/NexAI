"""Invigilation session tests: activate roster payload, QR validation
contract ({usn}-{exam_session_id}), duplicate-safe attendance, incident and
booklet endpoints."""
from datetime import date, time

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from eligibility.models import HallTicket
from scheduling.models import (
    ExamIncidentReport,
    ExamSession,
    InvigilationDuty,
    InvigilatorSessionKey,
    Room,
    StudentExamAttendance,
    Subject,
    TimetableSlot,
)
from users.models import Department, Student, User

ACTIVATE_URL = "/api/v1/scheduling/invigilator-keys/activate/"
MARK_URL = "/api/v1/scheduling/invigilator/mark-attendance/"
INCIDENT_URL = "/api/v1/scheduling/invigilator/incident/"
BOOKLET_URL = "/api/v1/scheduling/invigilator/booklet/"
KEY = "INVG001"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name="CS", code="CS")

    inv_user = User.objects.create_user(
        email="inv@test.com", password="pwd", full_name="Test Invigilator",
        role="INVIGILATOR", department=dept,
    )
    stu_a = User.objects.create_user(
        email="a@test.com", password="pwd", full_name="Ananya Rao",
        role="STUDENT", department=dept,
    )
    student_a = Student.objects.create(
        user=stu_a, department=dept, usn="1RV25CS001",
        current_semester=5, batch_year=2025,
    )
    stu_b = User.objects.create_user(
        email="b@test.com", password="pwd", full_name="Bharat Shetty",
        role="STUDENT", department=dept,
    )
    student_b = Student.objects.create(
        user=stu_b, department=dept, usn="1RV25CS002",
        current_semester=5, batch_year=2025,
    )
    stu_c = User.objects.create_user(
        email="c@test.com", password="pwd", full_name="Chetna Iyer",
        role="STUDENT", department=dept,
    )
    student_c = Student.objects.create(
        user=stu_c, department=dept, usn="1RV25CS003",
        current_semester=5, batch_year=2025,
    )

    subject = Subject.objects.create(
        code="CS501", name="Operating Systems",
        department=dept, semester=5, batch_year=2025,
    )
    session = ExamSession.objects.create(
        name="CIE-1 Fall 2026", semester=5, academic_year="2026",
        start_date=date(2026, 9, 1), end_date=date(2026, 12, 1),
    )
    other_session = ExamSession.objects.create(
        name="SEE November 2026", semester=5, academic_year="2026",
        start_date=date(2026, 9, 1), end_date=date(2026, 12, 1),
    )
    room = Room.objects.create(name="CRB-1", building="CRB", total_capacity=60, exam_capacity=30)

    today = timezone.localdate()
    slot = TimetableSlot.objects.create(
        exam_session=session,
        subject=subject,
        room=room,
        exam_date=today,
        start_time=time(0, 0),
        end_time=time(23, 59),
        seat_map={"1RV25CS001": "R1-S1", "1RV25CS003": "R1-S2"},
    )
    duty = InvigilationDuty.objects.create(
        timetable_slot=slot, invigilator=inv_user, duty_role="CHIEF",
    )
    key = InvigilatorSessionKey.objects.create(duty=duty, session_key=KEY, is_active=True)

    ticket_a = HallTicket.objects.create(student=student_a, exam_session=session)
    # mirror the contract written by eligibility/tasks.py during generation
    ticket_a.qr_code_data = f"{student_a.usn}-{session.id}"
    ticket_a.save(update_fields=["qr_code_data"])
    assert ticket_a.qr_code_data == f"{student_a.usn}-{session.id}"

    return {
        "invigilator": inv_user,
        "student_a": student_a,
        "student_b": student_b,
        "student_c": student_c,
        "session": session,
        "other_session": other_session,
        "slot": slot,
        "duty": duty,
        "key": key,
        "ticket_a": ticket_a,
        "room": room,
        "subject": subject,
    }


def _qr(s):
    return f"{s['student_a'].usn}-{s['session'].id}"


@pytest.mark.django_db
class TestActivateRoster:
    def test_activate_returns_full_roster(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(ACTIVATE_URL, {"session_key": KEY}, format="json")

        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data["exam_session_id"] == str(setup["session"].id)
        assert data["hallNumber"] == "CRB-1"
        assert data["courseCode"] == "CS501"
        assert data["chiefInvigilatorName"] == "Test Invigilator"
        assert data["counts"]["total"] == 2
        assert data["counts"]["unverified"] == 2

        by_usn = {s["usn"]: s for s in data["students"]}
        assert set(by_usn) == {"1RV25CS001", "1RV25CS003"}
        a = by_usn["1RV25CS001"]
        assert a["studentName"] == "Ananya Rao"
        assert a["deskId"] == "R1-S1"
        assert a["seatPosition"] == "Row 1, Seat 1"
        assert a["courseCode"] == "CS501"
        assert a["status"] == "unverified"
        assert a["bookletBarcode"] is None
        assert a["avatarInitials"] == "AR"

    def test_activate_unknown_key(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(ACTIVATE_URL, {"session_key": "NOPE999"}, format="json")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_activate_requires_active_key(self, api_client, setup):
        setup["key"].is_active = False
        setup["key"].save(update_fields=["is_active"])
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(ACTIVATE_URL, {"session_key": KEY}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_activate_outside_grace_window(self, api_client, setup):
        slot = TimetableSlot.objects.create(
            exam_session=setup["session"],
            subject=setup["subject"],
            room=setup["room"],
            exam_date=date(2025, 1, 1),
            start_time=time(10, 0),
            end_time=time(13, 0),
            seat_map={},
        )
        duty = InvigilationDuty.objects.create(
            timetable_slot=slot, invigilator=setup["invigilator"],
        )
        InvigilatorSessionKey.objects.create(duty=duty, session_key="OLD999X", is_active=True)

        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(ACTIVATE_URL, {"session_key": "OLD999X"}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "ended" in res.data["error"]


@pytest.mark.django_db
class TestQRAttendance:
    def test_valid_qr_marks_present(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": _qr(setup),
        }, format="json")

        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "PRESENT"
        assert res.data["qr_valid"] is True
        assert res.data["already_marked"] is False
        assert res.data["seat"] == "R1-S1"
        assert res.data["student_name"] == "Ananya Rao"

        att = StudentExamAttendance.objects.get(
            timetable_slot=setup["slot"], student=setup["student_a"],
        )
        assert att.status == "present"
        assert att.is_qr_verified is True

    def test_duplicate_scan_is_idempotent(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        body = {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": _qr(setup),
        }
        first = api_client.post(MARK_URL, body, format="json")
        second = api_client.post(MARK_URL, body, format="json")

        assert first.status_code == status.HTTP_200_OK
        assert second.status_code == status.HTTP_200_OK
        assert second.data["already_marked"] is True
        assert StudentExamAttendance.objects.filter(
            timetable_slot=setup["slot"],
        ).count() == 1

    def test_qr_from_other_session_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": f"{setup['student_a'].usn}-{setup['other_session'].id}",
        }, format="json")

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["qr_valid"] is False
        assert "different exam session" in res.data["error"]
        assert not StudentExamAttendance.objects.exists()

    def test_qr_usn_mismatch_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": f"{setup['student_c'].usn}-{setup['session'].id}",
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert not StudentExamAttendance.objects.exists()

    def test_malformed_qr_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": "not-a-hall-ticket",
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["qr_valid"] is False

    def test_revoked_hall_ticket_rejected(self, api_client, setup):
        setup["ticket_a"].is_revoked = True
        setup["ticket_a"].save(update_fields=["is_revoked"])
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": _qr(setup),
        }, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert not StudentExamAttendance.objects.exists()

    def test_student_not_in_hall_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_b"].usn,
            "qr_payload": f"{setup['student_b'].usn}-{setup['session'].id}",
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "not assigned" in res.data["error"]

    def test_manual_absent_without_qr(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "status": "absent",
        }, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "ABSENT"

        att = StudentExamAttendance.objects.get(
            timetable_slot=setup["slot"], student=setup["student_a"],
        )
        assert att.status == "absent"
        assert att.is_qr_verified is False

    def test_invalid_status_rejected(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "status": "banana",
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_roster_reflects_attendance_after_mark(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": _qr(setup),
        }, format="json")

        res = api_client.post(ACTIVATE_URL, {"session_key": KEY}, format="json")
        by_usn = {s["usn"]: s for s in res.data["students"]}
        assert by_usn["1RV25CS001"]["status"] == "present"
        assert by_usn["1RV25CS001"]["isQrVerified"] is True
        assert by_usn["1RV25CS003"]["status"] == "unverified"
        assert res.data["counts"]["present"] == 1
        assert res.data["counts"]["unverified"] == 1


@pytest.mark.django_db
class TestIncidentAndBooklet:
    def test_incident_persists_and_flags_malpractice(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(INCIDENT_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "infraction_type": "Electronic Device / Smart Watch / Phone",
            "description": "Phone found under desk.",
        }, format="json")

        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["studentUsn"] == "1RV25CS001"
        assert res.data["studentName"] == "Ananya Rao"
        assert res.data["isBroadcastedToCoE"] is True
        assert ExamIncidentReport.objects.count() == 1

        att = StudentExamAttendance.objects.get(
            timetable_slot=setup["slot"], student=setup["student_a"],
        )
        assert att.status == "malpractice"

        # incident appears in the roster payload
        activate = api_client.post(ACTIVATE_URL, {"session_key": KEY}, format="json")
        assert len(activate.data["incidents"]) == 1
        assert activate.data["incidents"][0]["infractionType"].startswith("Electronic Device")
        assert activate.data["counts"]["malpractice"] == 1

    def test_booklet_requires_attendance_first(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        res = api_client.post(BOOKLET_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "booklet_barcode": "BC-100001",
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "present" in res.data["error"]

    def test_booklet_tagging_roundtrip(self, api_client, setup):
        api_client.force_authenticate(user=setup["invigilator"])
        api_client.post(MARK_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "qr_payload": _qr(setup),
        }, format="json")

        res = api_client.post(BOOKLET_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "booklet_barcode": "BC-100001",
            "dummy_barcode": "ANON-CS501-100001",
        }, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["already_tagged"] is False

        # same barcode again -> idempotent
        again = api_client.post(BOOKLET_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "booklet_barcode": "BC-100001",
        }, format="json")
        assert again.status_code == status.HTTP_200_OK
        assert again.data["already_tagged"] is True

        # different barcode -> conflict
        conflict = api_client.post(BOOKLET_URL, {
            "session_key": KEY,
            "usn": setup["student_a"].usn,
            "booklet_barcode": "BC-999999",
        }, format="json")
        assert conflict.status_code == status.HTTP_409_CONFLICT

        # roster shows the booklet and the counter
        activate = api_client.post(ACTIVATE_URL, {"session_key": KEY}, format="json")
        by_usn = {s["usn"]: s for s in activate.data["students"]}
        assert by_usn["1RV25CS001"]["bookletBarcode"] == "BC-100001"
        assert activate.data["counts"]["booklets"] == 1

