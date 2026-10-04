from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("admin/users", views.AdminUserViewSet, basename="admin-user")
router.register("admin/audit-logs", views.AdminAuditLogViewSet, basename="admin-audit-log")

urlpatterns = [
    path("admin/stats/", views.AdminStatsView.as_view(), name="admin-stats"),
    path("admin/config/", views.AdminConfigView.as_view(), name="admin-config"),
    *router.urls,
]
