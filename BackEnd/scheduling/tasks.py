"""
NexAI Scheduling – Celery Tasks
Async timetable generation triggered by CoE via the API.
"""
import logging
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(
    bind=True,
    name="scheduling.generate_timetable",
    max_retries=2,
    default_retry_delay=60,
    acks_late=True,
    track_started=True,
)
def generate_timetable(self, exam_session_id: str, time_limit_secs: int = 120) -> dict:
    """
    Celery task: run the OR-Tools CP-SAT solver for an ExamSession
    and persist the resulting TimetableSlots to the database.

    Args:
        exam_session_id: UUID string of the ExamSession to schedule.
        time_limit_secs: Max wall-clock time for the solver.

    Returns:
        dict with keys: success, slots_created, solver_status, wall_time_secs
    """
    from scheduling.models import ExamSession, TimetableSlot, Room, Subject
    from scheduling.solver import TimetableSolver, build_schedule_input_from_orm

    logger.info("Starting timetable generation for ExamSession %s", exam_session_id)

    try:
        session = ExamSession.objects.get(id=exam_session_id)
    except ExamSession.DoesNotExist:
        logger.error("ExamSession %s not found", exam_session_id)
        return {"success": False, "error": "ExamSession not found"}

    # Mark session as in-progress (store task id)
    session.scheduling_task_id = self.request.id
    session.save(update_fields=["scheduling_task_id"])

    try:
        # ── 1. Build solver input from ORM ────────────────────────────────────
        schedule_input = build_schedule_input_from_orm(exam_session_id)

        if not schedule_input.subjects:
            return {
                "success": False,
                "error": "No active subjects found for this session's semester",
            }
        if not schedule_input.rooms:
            return {"success": False, "error": "No active rooms found"}
        if not schedule_input.time_slots:
            return {"success": False, "error": "No time slots generated (check exam dates)"}

        # ── 2. Run solver ────────────────────────────────────────────────────
        solver = TimetableSolver(schedule_input, time_limit_secs=time_limit_secs)
        result = solver.solve()

        if not result.success:
            logger.warning(
                "Solver failed for session %s: %s", exam_session_id, result.error
            )
            return {
                "success": False,
                "solver_status": result.solver_status,
                "error": result.error,
            }

        # ── 3. Persist assignments to DB ──────────────────────────────────────
        # Clear any previous draft slots for this session
        TimetableSlot.objects.filter(
            exam_session_id=exam_session_id,
            status=TimetableSlot.SlotStatus.SCHEDULED,
        ).delete()

        slots_to_create = []
        for assignment in result.assignments:
            slots_to_create.append(
                TimetableSlot(
                    exam_session_id=exam_session_id,
                    subject_id=assignment.subject_id,
                    room_id=assignment.room_id,
                    exam_date=assignment.time_slot.exam_date,
                    start_time=assignment.time_slot.start_time,
                    end_time=assignment.time_slot.end_time,
                    status=TimetableSlot.SlotStatus.SCHEDULED,
                    solver_score=result.objective_value,
                )
            )

        created_slots = TimetableSlot.objects.bulk_create(slots_to_create, ignore_conflicts=True)
        
        # In bulk_create on SQLite/PostgreSQL, IDs might not be returned reliably for ignore_conflicts=True
        # Fetch the newly created slots to assign invigilation duties
        saved_slots = TimetableSlot.objects.filter(
            exam_session_id=exam_session_id,
            status=TimetableSlot.SlotStatus.SCHEDULED,
        ).select_related("subject")

        from scheduling.models import InvigilationDuty
        
        duties_to_create = []
        for slot in saved_slots:
            # Find the matching assignment by subject
            for asgn in result.assignments:
                if str(slot.subject_id) == asgn.subject_id and asgn.invigilator_id:
                    duties_to_create.append(
                        InvigilationDuty(
                            timetable_slot=slot,
                            invigilator_id=asgn.invigilator_id,
                            duty_role=InvigilationDuty.DutyRole.CHIEF_INVIGILATOR,
                        )
                    )
                    break
        
        if duties_to_create:
            InvigilationDuty.objects.bulk_create(duties_to_create, ignore_conflicts=True)

        # ── 4. Update session status ──────────────────────────────────────────
        session.status = ExamSession.SessionStatus.SCHEDULED
        session.save(update_fields=["status"])

        # Automatically generate hall tickets (digital access) so students can view the CIE schedule
        from eligibility.tasks import generate_hall_tickets_for_session
        generate_hall_tickets_for_session.delay(str(session.id))

        logger.info(
            "Timetable generation complete: %d slots created for session %s (%.2fs)",
            len(slots_to_create),
            exam_session_id,
            result.wall_time_secs,
        )

        return {
            "success": True,
            "slots_created": len(slots_to_create),
            "solver_status": result.solver_status,
            "wall_time_secs": round(result.wall_time_secs, 3),
            "objective_value": result.objective_value,
        }

    except Exception as exc:
        logger.exception("Timetable generation failed for session %s", exam_session_id)
        # Retry up to max_retries times
        raise self.retry(exc=exc)


@shared_task(name="scheduling.cleanup_draft_sessions")
def cleanup_draft_sessions():
    """
    Periodic task: remove TimetableSlots for DRAFT sessions older than 7 days.
    Scheduled via django-celery-beat.
    """
    from django.utils import timezone
    from datetime import timedelta
    from scheduling.models import ExamSession, TimetableSlot

    cutoff = timezone.now() - timedelta(days=7)
    stale = ExamSession.objects.filter(
        status=ExamSession.SessionStatus.DRAFT,
        created_at__lt=cutoff,
    )
    count, _ = TimetableSlot.objects.filter(exam_session__in=stale).delete()
    logger.info("Cleaned up %d stale timetable slots", count)
    return {"deleted": count}
