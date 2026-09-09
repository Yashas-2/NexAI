from django.urls import path
from .views import (
    CIEConfigListCreateView,
    CIEConfigDetailView,
    CIEConfigActivateView,
    CIEMarksListView,
    CIEMarksBulkUpsertView,
    AssignmentMarksBulkView,
    CIEAggregateView,
    CIEEligibilityView,
    CIEBulkEligibilityView,
    CIEScrutinyListCreateView,
    CIEScrutinyDetailView,
    CIEScrutinyApproveView,
    CIEScrutinyRejectView,
)

app_name = "cie"

urlpatterns = [
    # Configs
    path("configs/", CIEConfigListCreateView.as_view(), name="config-list-create"),
    path("configs/<uuid:pk>/", CIEConfigDetailView.as_view(), name="config-detail"),
    path("configs/<uuid:pk>/activate/", CIEConfigActivateView.as_view(), name="config-activate"),

    # Marks
    path("marks/", CIEMarksListView.as_view(), name="marks-list"),
    path("marks/bulk/", CIEMarksBulkUpsertView.as_view(), name="marks-bulk-upsert"),
    path("assignment-marks/bulk/", AssignmentMarksBulkView.as_view(), name="assignment-marks-bulk"),

    # Aggregate & Eligibility
    path("aggregate/", CIEAggregateView.as_view(), name="aggregate"),
    path("eligibility/", CIEEligibilityView.as_view(), name="eligibility-detail"),
    path("eligibility/bulk/", CIEBulkEligibilityView.as_view(), name="eligibility-bulk"),

    # Scrutiny
    path("scrutiny/", CIEScrutinyListCreateView.as_view(), name="scrutiny-list-create"),
    path("scrutiny/<uuid:pk>/", CIEScrutinyDetailView.as_view(), name="scrutiny-detail"),
    path("scrutiny/<uuid:pk>/approve/", CIEScrutinyApproveView.as_view(), name="scrutiny-approve"),
    path("scrutiny/<uuid:pk>/reject/", CIEScrutinyRejectView.as_view(), name="scrutiny-reject"),
]

from rest_framework.routers import DefaultRouter
from .views import CIETestViewSet

router = DefaultRouter()
router.register(r'test', CIETestViewSet, basename='cietest')

from django.urls import include
urlpatterns += [
    path("", include(router.urls)),
]
