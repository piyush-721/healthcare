from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("lab-reports", views.LabReportViewSet, basename="lab-report")

urlpatterns = router.urls
