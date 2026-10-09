"""Invigilator auto-assignment rules: only normal FACULTY from the subject's
own branch may be auto-assigned — never HOD, evaluator, CoE or any other role."""
import pytest

from scheduling.models import Subject
from scheduling.serializers import ExamSessionSerializer
from scheduling.views import _pick_faculty_invigilator
from users.models import Department, User


@pytest.fixture
def branches(db):
    cs = Department.objects.create(name="Computer Science", code="CS")
    me = Department.objects.create(name="Mechanical", code="ME")

    hod = User.objects.create_user(
        email="hod@t", password="pwd", full_name="CS HOD",
        role="HOD", department=cs,
    )
    evaluator = User.objects.create_user(
        email="ev@t", password="pwd", full_name="CS Evaluator",
        role="EVALUATOR", department=cs,
    )
    fac_one = User.objects.create_user(
        email="f1@t", password="pwd", full_name="F One",
        role="FACULTY", department=cs,
    )
    fac_two = User.objects.create_user(
        email="f2@t", password="pwd", full_name="F Two",
        role="FACULTY", department=cs,
    )
    me_fac = User.objects.create_user(
        email="mf@t", password="pwd", full_name="ME Fac",
        role="FACULTY", department=me,
    )

    cs_subj = Subject.objects.create(
        code="CS501", name="Operating Systems",
        department=cs, semester=5, batch_year=2025,
    )
    me_subj = Subject.objects.create(
        code="ME501", name="Thermodynamics",
        department=me, semester=5, batch_year=2025,
    )
    ee = Department.objects.create(name="Electrical", code="EE")
    no_fac_subj = Subject.objects.create(
        code="EE501", name="Circuits",
        department=ee, semester=5, batch_year=2025,
    )

    return {
        "cs": cs, "me": me,
        "hod": hod, "evaluator": evaluator,
        "fac_one": fac_one, "fac_two": fac_two, "me_fac": me_fac,
        "cs_subj": cs_subj, "me_subj": me_subj, "no_fac_subj": no_fac_subj,
    }


@pytest.mark.django_db
class TestPickFacultyInvigilator:
    def test_picks_only_same_branch_faculty(self, branches):
        rot = {}
        picks = [_pick_faculty_invigilator(branches["cs_subj"], rot) for _ in range(6)]
        allowed = {branches["fac_one"].id, branches["fac_two"].id}
        assert {u.id for u in picks} <= allowed

    def test_never_returns_hod_or_evaluator(self, branches):
        rot = {}
        for _ in range(10):
            picked = _pick_faculty_invigilator(branches["cs_subj"], rot)
            assert picked.role == "FACULTY"
            assert picked.id not in {branches["hod"].id, branches["evaluator"].id}

    def test_rotation_alternates_within_branch(self, branches):
        rot = {}
        first = _pick_faculty_invigilator(branches["cs_subj"], rot)
        second = _pick_faculty_invigilator(branches["cs_subj"], rot)
        third = _pick_faculty_invigilator(branches["cs_subj"], rot)
        assert first.id != second.id
        assert first.id == third.id

    def test_falls_back_to_faculty_not_other_roles(self, branches):
        # EE branch has no faculty of its own -> any FACULTY, still never HOD/etc.
        rot = {}
        for _ in range(6):
            picked = _pick_faculty_invigilator(branches["no_fac_subj"], rot)
            assert picked.role == "FACULTY"
            assert picked.id != branches["hod"].id

    def test_rotation_is_independent_per_branch(self, branches):
        rot = {}
        for _ in range(4):
            me_pick = _pick_faculty_invigilator(branches["me_subj"], rot)
            assert me_pick.id == branches["me_fac"].id
            _pick_faculty_invigilator(branches["cs_subj"], rot)


def _session_payload(subject_code, invigilator_id):
    return {
        "name": "CIE-1 Test Series",
        "session_type": "CIE",
        "semester": 5,
        "academic_year": "2026",
        "start_date": "2026-10-01",
        "end_date": "2026-10-31",
        "subject_codes": [subject_code],
        "calculated_sessions": [
            {
                "subjectCode": subject_code,
                "chiefInvigilatorId": str(invigilator_id),
                "examDate": "2026-10-09",
                "timeSlot": "10:00 AM - 11:00 AM",
                "roomsAllocated": ["CRB-1"],
            }
        ],
    }


@pytest.mark.django_db
class TestChiefInvigilatorValidation:
    def test_rejects_hod_chief(self, branches):
        payload = _session_payload("CS501", branches["hod"].id)
        ser = ExamSessionSerializer(data=payload)
        assert not ser.is_valid()
        assert "calculated_sessions" in ser.errors

    def test_rejects_evaluator_chief(self, branches):
        payload = _session_payload("CS501", branches["evaluator"].id)
        ser = ExamSessionSerializer(data=payload)
        assert not ser.is_valid()
        assert "calculated_sessions" in ser.errors

    def test_rejects_cross_branch_faculty_chief(self, branches):
        payload = _session_payload("CS501", branches["me_fac"].id)
        ser = ExamSessionSerializer(data=payload)
        assert not ser.is_valid()
        assert "calculated_sessions" in ser.errors

    def test_rejects_unknown_invigilator(self, branches):
        payload = _session_payload("CS501", "00000000-0000-0000-0000-000000000000")
        ser = ExamSessionSerializer(data=payload)
        assert not ser.is_valid()
        assert "calculated_sessions" in ser.errors

    def test_accepts_same_branch_faculty_chief(self, branches):
        payload = _session_payload("CS501", branches["fac_one"].id)
        ser = ExamSessionSerializer(data=payload)
        assert ser.is_valid(), ser.errors

    def test_accepts_session_without_chief(self, branches):
        payload = _session_payload("CS501", None)
        payload["calculated_sessions"][0].pop("chiefInvigilatorId")
        ser = ExamSessionSerializer(data=payload)
        assert ser.is_valid(), ser.errors
