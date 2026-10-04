from django.apps import AppConfig


class RecordsConfig(AppConfig):
    name = "apps.records"
    label = "records"

    def ready(self) -> None:
        from . import signals  # noqa: F401
