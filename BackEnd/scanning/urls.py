"""NexAI Scanning – URL Configuration"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ScanningSessionViewSet, BookletPacketViewSet

router = DefaultRouter()
router.register(r'sessions', ScanningSessionViewSet, basename='scanning-session')
router.register(r'booklets', BookletPacketViewSet, basename='booklet-packet')

urlpatterns = [
    path('', include(router.urls)),
]
