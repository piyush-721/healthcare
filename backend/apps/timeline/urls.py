from django.urls import path

from . import dashboard, views

urlpatterns = [
    path("timeline/", views.TimelineView.as_view(), name="timeline"),
    path("dashboard/", dashboard.DashboardView.as_view(), name="dashboard"),
]
