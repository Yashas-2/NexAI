from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnswerScriptViewSet, EvaluationBundleViewSet, ResultPublishViewSet

router = DefaultRouter()
router.register(r'scripts', AnswerScriptViewSet, basename='answerscript')
router.register(r'bundles', EvaluationBundleViewSet, basename='evaluationbundle')
router.register(r'results', ResultPublishViewSet, basename='resultpublish')

urlpatterns = [
    path('', include(router.urls)),
]
