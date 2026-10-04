from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("appointments", views.AppointmentViewSet, basename="appointment")

urlpatterns = router.urls
