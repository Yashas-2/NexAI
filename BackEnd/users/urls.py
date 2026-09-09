"""NexAI Users - URL Configuration"""
from django.urls import path
from .views import (
    NexAILoginView,
    NexAIRefreshView,
    NexAILogoutView,
    UserProfileView,
    UserCreateView,
    UserListView,
    UserDetailView,
    DepartmentListView,
    reset_user_password,
    suspend_user,
    restore_user,
    biometric_enroll,
    biometric_verify,
    BulkStudentImportView,
    AdmissionImportHistoryView,
    bulk_delete_students,
    StudentStatsView,
)

app_name = "users"

urlpatterns = [
    # Auth
    path("login/",          NexAILoginView.as_view(),   name="login"),
    path("refresh/",        NexAIRefreshView.as_view(), name="token-refresh"),
    path("logout/",         NexAILogoutView.as_view(),  name="logout"),

    # Profile
    path("me/",             UserProfileView.as_view(),  name="profile"),

    # Departments
    path("departments/",    DepartmentListView.as_view(), name="department-list"),

    # User management (CoE / HOD)
    path("users/",                          UserListView.as_view(),          name="user-list"),
    path("users/create/",                   UserCreateView.as_view(),        name="user-create"),
    path("users/<uuid:pk>/",                UserDetailView.as_view(),        name="user-detail"),
    path("users/<uuid:pk>/reset-password/", reset_user_password,             name="user-reset-password"),
    path("users/<uuid:pk>/suspend/",        suspend_user,                    name="user-suspend"),
    path("users/<uuid:pk>/restore/",        restore_user,                    name="user-restore"),

    # Student bulk import & management (Admission / CoE)
    path("students/import/",         BulkStudentImportView.as_view(),       name="student-bulk-import"),
    path("students/import/history/", AdmissionImportHistoryView.as_view(),  name="student-import-history"),
    path("students/stats/",          StudentStatsView.as_view(),            name="student-stats"),
    path("students/bulk-delete/",    bulk_delete_students,                  name="student-bulk-delete"),

    # Biometrics
    path("biometric/enroll/",  biometric_enroll,  name="biometric-enroll"),
    path("biometric/verify/",  biometric_verify,  name="biometric-verify"),
]
