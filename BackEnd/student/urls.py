from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentPortalViewSet, SEETestViewSet

router = DefaultRouter()
router.register(r'portal', StudentPortalViewSet, basename='studentportal')
router.register(r'see', SEETestViewSet, basename='see-test')

urlpatterns = [
    path('', include(router.urls)),
]
