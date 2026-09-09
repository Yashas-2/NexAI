"""NexAI Scheduling – URL Configuration"""
from django.urls import path
from .views import (
    SubjectListCreateView,
    SubjectDetailView,
    SubjectEnrolledStudentsView,
    SubjectEnrollView,
    SubjectBatchEnrollView,
    RoomListCreateView,
    RoomDetailView,
    ExamSessionListCreateView,
    ExamSessionDetailView,
    TimetableSlotListView,
    TimetableSlotDetailView,
    trigger_timetable_generation,
    timetable_task_status,
    seating_blueprint,
    InvigilationDutyListCreateView,
    AllocationSaveView,
    InvigilatorSessionKeyView,
    InvigilatorSessionKeyActivateView,
    MarkAttendanceView,
)

app_name = "scheduling"

urlpatterns = [
    # Subjects
    path("subjects/",             SubjectListCreateView.as_view(),   name="subject-list"),
    path("subjects/<uuid:pk>/",   SubjectDetailView.as_view(),       name="subject-detail"),
    path("subjects/<uuid:pk>/enrolled-students/", SubjectEnrolledStudentsView.as_view(), name="subject-enrolled-students"),
    path("subjects/<uuid:pk>/enroll/", SubjectEnrollView.as_view(), name="subject-enroll"),
    path("subjects/<uuid:pk>/batch-enroll/", SubjectBatchEnrollView.as_view(), name="subject-batch-enroll"),

    # Rooms
    path("rooms/",                RoomListCreateView.as_view(),      name="room-list"),
    path("rooms/<uuid:pk>/",      RoomDetailView.as_view(),          name="room-detail"),

    # Exam Sessions
    path("sessions/",             ExamSessionListCreateView.as_view(), name="session-list"),
    path("sessions/<uuid:pk>/",   ExamSessionDetailView.as_view(),     name="session-detail"),

    # Timetable
    path("timetable/",                                TimetableSlotListView.as_view(),  name="timetable-list"),
    path("timetable/<uuid:pk>/",                      TimetableSlotDetailView.as_view(), name="timetable-detail"),
    path("timetable/generate/",                       trigger_timetable_generation,     name="timetable-generate"),
    path("timetable/status/<str:task_id>/",           timetable_task_status,            name="timetable-status"),
    path("seating-blueprint/",                        seating_blueprint,                name="seating-blueprint"),

    # Invigilation
    path("invigilation/",         InvigilationDutyListCreateView.as_view(), name="invigilation-list"),
    path("allocation/save/",     AllocationSaveView.as_view(),             name="allocation-save"),

    # Session Keys
    path("invigilator-keys/",         InvigilatorSessionKeyView.as_view(), name="invigilator-key-list"),
    path("invigilator-keys/<uuid:pk>/activate/", InvigilatorSessionKeyActivateView.as_view(), name="invigilator-key-activate"),
    path("invigilator/mark-attendance/", MarkAttendanceView.as_view(), name="mark-attendance"),
]
