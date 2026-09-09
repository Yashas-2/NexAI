"""NexAI – Root URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

API_V1 = "api/v1/"

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v1 routes
    path(API_V1 + "auth/",         include("users.urls")),
    path(API_V1 + "coe/",          include("analytics.urls")),
    path(API_V1 + "hod/",          include("eligibility.urls")),
    path(API_V1 + "eligibility/",  include("eligibility.urls")),
    path(API_V1 + "vault/",        include("vault.urls")),
    path(API_V1 + "scan/",         include("scanning.urls")),
    path(API_V1 + "evaluation/",   include("evaluation.urls")),
    path(API_V1 + "proctor/",      include("proctoring.urls")),
    path(API_V1 + "student/",      include("student.urls")),
    path(API_V1 + "scheduling/",   include("scheduling.urls")),
    path(API_V1 + "notifications/", include("notifications.urls")),
    path(API_V1 + "cie/",          include("cie.urls")),
]

if settings.DEBUG and "debug_toolbar" in settings.INSTALLED_APPS:
    import debug_toolbar
    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
