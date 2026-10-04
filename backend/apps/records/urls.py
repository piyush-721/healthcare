from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("providers", views.CareProviderViewSet, basename="provider")
router.register("records", views.MedicalRecordViewSet, basename="record")
router.register("documents", views.MedicalDocumentViewSet, basename="document")

urlpatterns = router.urls
