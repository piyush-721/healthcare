from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("medications", views.MedicationViewSet, basename="medication")

urlpatterns = router.urls
