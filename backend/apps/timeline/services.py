"""Unified health timeline derived from domain entities.

There is deliberately no timeline table: events are projected from the source
records at read time, so the timeline can never drift from the underlying data
and edits/deletions are reflected immediately. Each source contributes only if
the caller holds the matching view permission.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q, QuerySet

from apps.appointments.models import Appointment
from apps.labs.models import LabReport
from apps.medications.models import Medication
from apps.profiles.access import Perm, ProfileAccess
from apps.profiles.models import MedicalCondition, VaccinationRecord
from apps.records.models import MedicalDocument, MedicalRecord
from apps.treatments.models import TreatmentPlan, TreatmentTask


class EventType:
    APPOINTMENT = "APPOINTMENT"
    MEDICATION_STARTED = "MEDICATION_STARTED"
    MEDICATION_ENDED = "MEDICATION_ENDED"
    RECORD = "RECORD"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    LAB_REPORT = "LAB_REPORT"
    TREATMENT_PLAN = "TREATMENT_PLAN"
    TREATMENT_TASK_DONE = "TREATMENT_TASK_DONE"
    VACCINATION = "VACCINATION"
    CONDITION = "CONDITION"

    ALL = (
        APPOINTMENT,
        MEDICATION_STARTED,
        MEDICATION_ENDED,
        RECORD,
        DOCUMENT_UPLOADED,
        LAB_REPORT,
        TREATMENT_PLAN,
        TREATMENT_TASK_DONE,
        VACCINATION,
        CONDITION,
    )


@dataclass
class TimelineEvent:
    key: str
    type: str
    occurred_at: datetime
    all_day: bool
    title: str
    subtitle: str
    resource: str
    resource_id: str
    status: str = ""

    def as_dict(self) -> dict:
        return {
            "id": self.key,
            "type": self.type,
            "occurred_at": self.occurred_at.isoformat(),
            "all_day": self.all_day,
            "title": self.title,
            "subtitle": self.subtitle,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "status": self.status,
        }


@dataclass
class TimelineQuery:
    types: set[str]
    start: date | None
    end: date | None
    search: str
    before: tuple[datetime, str] | None
    limit: int


@dataclass
class _Source:
    event_type: str
    permission: str
    queryset: Callable[[ProfileAccess], QuerySet]
    field: str
    is_date: bool
    search_fields: tuple[str, ...]
    build: Callable[[object], tuple[str, str, str, str]]  # title, subtitle, resource, status


def _sources() -> list[_Source]:
    return [
        _Source(
            EventType.APPOINTMENT,
            Perm.VIEW_APPOINTMENTS,
            lambda a: Appointment.objects.filter(profile=a.profile).select_related("provider"),
            "scheduled_at",
            False,
            ("title", "reason", "provider_name"),
            lambda o: (
                o.title,
                o.provider.name if o.provider else o.provider_name,
                "appointment",
                o.status,
            ),
        ),
        _Source(
            EventType.MEDICATION_STARTED,
            Perm.VIEW_MEDICATIONS,
            lambda a: Medication.objects.filter(profile=a.profile),
            "start_date",
            True,
            ("name",),
            lambda o: (f"Started {o.name}", o.dosage, "medication", o.status),
        ),
        _Source(
            EventType.MEDICATION_ENDED,
            Perm.VIEW_MEDICATIONS,
            lambda a: Medication.objects.filter(profile=a.profile, end_date__isnull=False),
            "end_date",
            True,
            ("name",),
            lambda o: (f"Course ended: {o.name}", o.dosage, "medication", o.status),
        ),
        _Source(
            EventType.RECORD,
            Perm.VIEW_DOCUMENTS,
            lambda a: MedicalRecord.objects.filter(profile=a.profile).select_related("provider"),
            "record_date",
            True,
            ("title", "description"),
            lambda o: (o.title, o.get_record_type_display(), "record", ""),
        ),
        _Source(
            EventType.DOCUMENT_UPLOADED,
            Perm.VIEW_DOCUMENTS,
            lambda a: MedicalDocument.objects.filter(profile=a.profile, archived_at__isnull=True),
            "created_at",
            False,
            ("title", "original_filename"),
            lambda o: (
                f"Uploaded {o.title}",
                o.get_document_type_display(),
                "document",
                o.scan_status,
            ),
        ),
        _Source(
            EventType.LAB_REPORT,
            Perm.VIEW_LAB_RESULTS,
            lambda a: LabReport.objects.filter(profile=a.profile),
            "report_date",
            True,
            ("title", "lab_name"),
            lambda o: (o.title, o.lab_name, "lab_report", ""),
        ),
        _Source(
            EventType.TREATMENT_PLAN,
            Perm.VIEW_TREATMENT_PLANS,
            lambda a: TreatmentPlan.objects.filter(profile=a.profile),
            "start_date",
            True,
            ("title", "description"),
            lambda o: (
                f"Treatment plan: {o.title}",
                o.get_status_display(),
                "treatment_plan",
                o.status,
            ),
        ),
        _Source(
            EventType.TREATMENT_TASK_DONE,
            Perm.VIEW_TREATMENT_PLANS,
            lambda a: TreatmentTask.objects.filter(
                plan__profile=a.profile, completed_at__isnull=False
            ).select_related("plan"),
            "completed_at",
            False,
            ("title",),
            lambda o: (f"Completed: {o.title}", o.plan.title, "treatment_plan", "DONE"),
        ),
        _Source(
            EventType.VACCINATION,
            Perm.VIEW_PROFILE,
            lambda a: VaccinationRecord.objects.filter(profile=a.profile),
            "administered_on",
            True,
            ("vaccine_name",),
            lambda o: (
                f"Vaccination: {o.vaccine_name}",
                f"Dose {o.dose_number}" if o.dose_number else o.administered_by,
                "vaccination",
                "",
            ),
        ),
        _Source(
            EventType.CONDITION,
            Perm.VIEW_PROFILE,
            lambda a: MedicalCondition.objects.filter(
                profile=a.profile, diagnosed_on__isnull=False
            ),
            "diagnosed_on",
            True,
            ("name",),
            lambda o: (
                f"Condition recorded: {o.name}",
                o.get_status_display(),
                "condition",
                o.status,
            ),
        ),
    ]


def _resource_id(event_type: str, obj: object) -> str:
    if event_type == EventType.TREATMENT_TASK_DONE:
        return str(obj.plan_id)  # type: ignore[attr-defined]
    return str(obj.pk)  # type: ignore[attr-defined]


def build_timeline(access: ProfileAccess, query: TimelineQuery, tz: ZoneInfo) -> dict:
    events: list[TimelineEvent] = []
    available: list[str] = []
    for source in _sources():
        if not access.can(source.permission):
            continue
        available.append(source.event_type)
        if query.types and source.event_type not in query.types:
            continue
        qs = source.queryset(access)
        if source.is_date:
            if query.start:
                qs = qs.filter(**{f"{source.field}__gte": query.start})
            if query.end:
                qs = qs.filter(**{f"{source.field}__lte": query.end})
            if query.before:
                qs = qs.filter(**{f"{source.field}__lte": query.before[0].astimezone(tz).date()})
        else:
            if query.start:
                qs = qs.filter(
                    **{f"{source.field}__gte": datetime.combine(query.start, time.min, tzinfo=tz)}
                )
            if query.end:
                qs = qs.filter(
                    **{
                        f"{source.field}__lt": datetime.combine(
                            query.end + timedelta(days=1), time.min, tzinfo=tz
                        )
                    }
                )
            if query.before:
                qs = qs.filter(**{f"{source.field}__lte": query.before[0]})
        if query.search:
            condition = Q()
            for name in source.search_fields:
                condition |= Q(**{f"{name}__icontains": query.search})
            qs = qs.filter(condition)
        for obj in qs.order_by(f"-{source.field}")[: query.limit + 1]:
            value = getattr(obj, source.field)
            occurred = datetime.combine(value, time.min, tzinfo=tz) if source.is_date else value
            title, subtitle, resource, status = source.build(obj)
            events.append(
                TimelineEvent(
                    key=f"{source.event_type}:{obj.pk}",
                    type=source.event_type,
                    occurred_at=occurred,
                    all_day=source.is_date,
                    title=title,
                    subtitle=subtitle or "",
                    resource=resource,
                    resource_id=_resource_id(source.event_type, obj),
                    status=status,
                )
            )

    events.sort(key=lambda e: (e.occurred_at, e.key), reverse=True)
    if query.before:
        events = [e for e in events if (e.occurred_at, e.key) < query.before]
    page = events[: query.limit]
    has_more = len(events) > query.limit
    next_cursor = None
    if has_more and page:
        last = page[-1]
        next_cursor = f"{last.occurred_at.isoformat()}|{last.key}"
    return {
        "results": [e.as_dict() for e in page],
        "next_cursor": next_cursor,
        "available_types": available,
    }


def parse_types(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {t.strip().upper() for t in raw.split(",") if t.strip().upper() in EventType.ALL}
