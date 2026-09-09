"""NexAI - Eligibility URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentEligibilityViewSet, HallTicketViewSet,
    BulkEligibilityUploadView, GenerateHallTicketsView,
    GenerateEligibilityView
)

router = DefaultRouter()
router.register(r'records', StudentEligibilityViewSet, basename='eligibility-records')
router.register(r'hall-tickets', HallTicketViewSet, basename='hall-tickets')

urlpatterns = [
    path('', include(router.urls)),
    path('upload-csv/', BulkEligibilityUploadView.as_view(), name='bulk-upload-csv'),
    path('generate-hall-tickets/<uuid:session_id>/', GenerateHallTicketsView.as_view(), name='generate-hall-tickets'),
    path('generate/', GenerateEligibilityView.as_view(), name='generate-eligibility'),
]
