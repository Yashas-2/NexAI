import json
import logging
import os
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta, datetime
from typing import Any

logger = logging.getLogger('nexai.scheduling')

@dataclass
class SubjectDTO:
    id: str
    code: str
    semester: int
    exam_duration_mins: int
    enrolled_student_ids: list = field(default_factory=list)
    required_capacity: int = 0
    coordinator_id: str = None

@dataclass
class RoomDTO:
    id: str
    name: str
    exam_capacity: int

@dataclass
class TimeSlotDTO:
    index: int
    exam_date: date
    start_time: Any
    end_time: Any

@dataclass
class ScheduleInput:
    subjects: list
    rooms: list
    invigilators: list
    time_slots: list
    student_enrollments: dict = field(default_factory=dict)
    exam_session_id: str = None

@dataclass
class SlotAssignment:
    subject_id: str
    subject_code: str
    room_id: str
    room_name: str
    time_slot: TimeSlotDTO
    invigilator_id: str = None

@dataclass
class ScheduleResult:
    success: bool
    assignments: list = field(default_factory=list)
    solver_status: str = ''
    wall_time_secs: float = 0.0
    objective_value: int = 0
    error: str = ''

def fetch_holidays(year: int):
    cache_file = f'holidays_{year}.json'
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                return json.load(f)
        except:
            pass
    try:
        url = f'https://date.nager.at/api/v3/PublicHolidays/{year}/IN'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            dates = [d['date'] for d in data]
            with open(cache_file, 'w') as f:
                json.dump(dates, f)
            return dates
    except Exception as e:
        logger.warning(f'Holiday API failed: {e}. Using cached data if any.')
        return []

def build_schedule_input_from_orm(exam_session_id: str) -> ScheduleInput:
    from scheduling.models import ExamSession, Subject, Room, StudentSubjectEnrollment
    from users.models import User
    from users.constants import UserRole
    from django.db.models import Q
    import datetime

    session = ExamSession.objects.get(id=exam_session_id)
    dept_codes = session.departments or []

    subjects_qs = session.subjects.filter(is_active=True).prefetch_related('student_enrollments')
    if not subjects_qs.exists():
        fallback_filter = Q(semester=session.semester, is_active=True)
        if dept_codes:
            fallback_filter &= Q(department__code__in=dept_codes)
        subjects_qs = Subject.objects.filter(fallback_filter).prefetch_related('student_enrollments')

    selected_room_names = session.selected_rooms or []
    if selected_room_names:
        rooms_qs = Room.objects.filter(is_active=True, name__in=selected_room_names).order_by('-exam_capacity')
    else:
        rooms_qs = Room.objects.filter(is_active=True).order_by('-exam_capacity')

    enrollments = StudentSubjectEnrollment.objects.filter(
        subject__in=subjects_qs, exam_session=session
    ).select_related('student')
    
    student_map = {}
    for enr in enrollments:
        sid = str(enr.student.id)
        sub_id = str(enr.subject.id)
        if sid not in student_map:
            student_map[sid] = set()
        student_map[sid].add(sub_id)

    subjects = []
    for sub in subjects_qs:
        sub_students = [sid for sid, subs in student_map.items() if str(sub.id) in subs]
        subjects.append(SubjectDTO(
            id=str(sub.id), code=sub.code, semester=sub.semester,
            exam_duration_mins=180, enrolled_student_ids=sub_students,
            required_capacity=len(sub_students), coordinator_id=str(sub.coordinator_id) if sub.coordinator_id else None
        ))

    rooms = [RoomDTO(id=str(r.id), name=r.name, exam_capacity=r.exam_capacity) for r in rooms_qs]
    
    start_date = session.start_date
    end_date = session.end_date
    
    holidays = fetch_holidays(start_date.year)
    
    time_slots = []
    curr = start_date
    idx = 0
    while curr <= end_date:
        if curr.weekday() != 6 and curr.strftime('%Y-%m-%d') not in holidays:
            time_slots.append(TimeSlotDTO(index=idx, exam_date=curr, start_time=datetime.time(9, 30), end_time=datetime.time(12, 30)))
            idx += 1
            if session.exams_per_day == 2:
                time_slots.append(TimeSlotDTO(index=idx, exam_date=curr, start_time=datetime.time(14, 0), end_time=datetime.time(17, 0)))
                idx += 1
        curr += timedelta(days=1)
        
    return ScheduleInput(subjects=subjects, rooms=rooms, invigilators=[], time_slots=time_slots, student_enrollments=student_map, exam_session_id=exam_session_id)

class TimetableSolver:
    def __init__(self, data: ScheduleInput, time_limit_secs: int = 120):
        self.data = data
        self.subjects = data.subjects
        self.rooms = data.rooms
        self.time_slots = data.time_slots

    def solve(self) -> ScheduleResult:
        # Phase 1: Conflict Graph & Greedy Coloring
        conflict_edges = set()
        for subs in self.data.student_enrollments.values():
            lst = list(subs)
            for i in range(len(lst)):
                for j in range(i+1, len(lst)):
                    conflict_edges.add((lst[i], lst[j]))
                    conflict_edges.add((lst[j], lst[i]))
                    
        sorted_subs = sorted(self.subjects, key=lambda s: s.required_capacity, reverse=True)
        
        slot_groups = [[] for _ in self.data.time_slots]
        
        for sub in sorted_subs:
            assigned = False
            for idx, group in enumerate(slot_groups):
                conflict = False
                for other_sub in group:
                    if (sub.id, other_sub.id) in conflict_edges:
                        conflict = True
                        break
                if not conflict:
                    group.append(sub)
                    assigned = True
                    break
            if not assigned:
                return ScheduleResult(success=False, error=f'Not enough time slots to schedule subject {sub.code} due to conflicts.')
                
        # Phase 2: Seating Optimization (A B A B) & Room Allocation
        assignments = []
        for slot_idx, group in enumerate(slot_groups):
            if not group:
                continue
            
            # Simple capacity check
            total_students = sum(s.required_capacity for s in group)
            total_room_cap = sum(r.exam_capacity for r in self.rooms)
            if total_students > total_room_cap:
                return ScheduleResult(success=False, error=f'Total students {total_students} in slot {slot_idx} exceeds room capacity {total_room_cap}.')
                
            # For each room, assign multiple subjects to achieve interleaving
            students_to_seat = {s.id: list(s.enrolled_student_ids) for s in group}
            active_subjects = [s for s in group if students_to_seat[s.id]]
            
            for room in self.rooms:
                room_rem = room.exam_capacity
                room_assigned_subs = set()
                while room_rem > 0 and active_subjects:
                    sub = active_subjects.pop(0)
                    chunk_size = min(room_rem, max(1, room_rem // len(active_subjects) if active_subjects else room_rem))
                    chunk = students_to_seat[sub.id][:chunk_size]
                    del students_to_seat[sub.id][:chunk_size]
                    
                    if chunk:
                        room_assigned_subs.add(sub.id)
                        room_rem -= len(chunk)
                        
                    if students_to_seat[sub.id]:
                        active_subjects.append(sub)
                        
                for sub_id in room_assigned_subs:
                    sub_obj = next(s for s in group if s.id == sub_id)
                    assignments.append(SlotAssignment(
                        subject_id=sub_obj.id,
                        subject_code=sub_obj.code,
                        room_id=room.id,
                        room_name=room.name,
                        time_slot=self.time_slots[slot_idx]
                    ))
                    
        return ScheduleResult(success=True, assignments=assignments, objective_value=100)
