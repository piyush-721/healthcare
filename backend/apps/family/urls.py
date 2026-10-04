from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("family/caregivers", views.CaregiverViewSet, basename="caregiver")
router.register("family/invitations", views.InvitationViewSet, basename="invitation")
router.register("family/caring-for", views.CaringForViewSet, basename="caring-for")

urlpatterns = [path("family/", views.FamilyOverviewView.as_view(), name="family"), *router.urls]
