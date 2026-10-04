from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("treatment-plans", views.TreatmentPlanViewSet, basename="treatment-plan")

urlpatterns = router.urls
