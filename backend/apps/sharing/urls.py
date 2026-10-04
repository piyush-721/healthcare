from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("shares", views.DataShareViewSet, basename="share")

urlpatterns = [
    path("shared/", views.SharedSummaryView.as_view(), name="shared-summary"),
    path(
        "shared/documents/<uuid:pk>/download/",
        views.SharedDocumentDownloadView.as_view(),
        name="shared-document-download",
    ),
    path("shared/<slug:section>/", views.SharedSectionView.as_view(), name="shared-section"),
    *router.urls,
]
