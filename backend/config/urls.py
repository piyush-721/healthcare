from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.common.cron import CronJobView
from apps.common.views import HealthView

api_v1 = [
    path("health/", HealthView.as_view(), name="health"),
    path("internal/cron/<slug:job>/", CronJobView.as_view(), name="cron-job"),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.profiles.urls")),
    path("", include("apps.family.urls")),
    path("", include("apps.records.urls")),
    path("", include("apps.medications.urls")),
    path("", include("apps.appointments.urls")),
    path("", include("apps.labs.urls")),
    path("", include("apps.treatments.urls")),
    path("", include("apps.sharing.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.timeline.urls")),
    path("", include("apps.administration.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

urlpatterns = [path("api/v1/", include(api_v1))]
