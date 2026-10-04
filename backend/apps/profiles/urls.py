from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("profiles", views.PatientProfileViewSet, basename="profile")
router.register("emergency-contacts", views.EmergencyContactViewSet, basename="emergency-contact")
router.register("allergies", views.AllergyViewSet, basename="allergy")
router.register("conditions", views.MedicalConditionViewSet, basename="condition")
router.register("vitals", views.VitalRecordViewSet, basename="vital")
router.register("vaccinations", views.VaccinationRecordViewSet, basename="vaccination")

urlpatterns = [path("profile/", views.MyProfileView.as_view(), name="my-profile"), *router.urls]
