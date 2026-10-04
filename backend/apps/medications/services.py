"""Dose computation: today's doses and adherence history.

Doses are derived from schedules on the fly rather than pre-generated, so edits
to a schedule take effect immediately and no background job must keep rows in sync.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.profiles.models import PatientProfile

from .models import Medication, MedicationLog, MedicationSchedule


def profile_timezone(profile: PatientProfile) -> ZoneInfo:
    return ZoneInfo(profile.owner.timezone)


@dataclass
class Dose:
    medication: Medication
    schedule: MedicationSchedule
    scheduled_for: datetime
    log: MedicationLog | None

    @property
    def status(self) -> str:
        if self.log is not None:
            return self.log.status
        return "OVERDUE" if self.scheduled_for < timezone.now() else "PENDING"


def doses_for_day(
    profile: PatientProfile, day: date, medications: list[Medication] | None = None
) -> list[Dose]:
    tz = profile_timezone(profile)
    if medications is None:
        medications = list(
            Medication.objects.filter(
                profile=profile, status=Medication.Status.ACTIVE
            ).prefetch_related("schedules")
        )
    slots: list[tuple[Medication, MedicationSchedule, datetime]] = []
    for med in medications:
        if not med.is_scheduled_on(day):
            continue
        for schedule in med.schedules.all():
            if schedule.applies_on(day):
                slots.append(
                    (med, schedule, datetime.combine(day, schedule.time_of_day, tzinfo=tz))
                )
    logs = {
        (log.schedule_id, log.scheduled_for): log
        for log in MedicationLog.objects.filter(
            schedule_id__in=[s.id for _, s, _ in slots],
            scheduled_for__in=[when for _, _, when in slots],
        )
    }
    doses = [Dose(m, s, when, logs.get((s.id, when))) for m, s, when in slots]
    return sorted(doses, key=lambda d: (d.scheduled_for, d.medication.name))


def adherence(medication: Medication, days: int) -> dict:
    tz = profile_timezone(medication.profile)
    today = timezone.now().astimezone(tz).date()
    start = max(medication.start_date, today - timedelta(days=days - 1))
    schedules = list(medication.schedules.all())
    logs = {
        (log.schedule_id, log.scheduled_for): log.status
        for log in medication.logs.filter(
            schedule__isnull=False, scheduled_for__date__gte=start - timedelta(days=1)
        )
    }
    now = timezone.now()
    history = []
    totals = {"scheduled": 0, "taken": 0, "skipped": 0, "missed": 0}
    day = start
    while day <= today:
        row = {"date": day.isoformat(), "scheduled": 0, "taken": 0, "skipped": 0, "missed": 0}
        in_range = medication.start_date <= day and (
            medication.end_date is None or day <= medication.end_date
        )
        if in_range and medication.frequency != Medication.Frequency.AS_NEEDED:
            for schedule in schedules:
                if not schedule.applies_on(day):
                    continue
                when = datetime.combine(day, schedule.time_of_day, tzinfo=tz)
                if when > now:
                    continue
                row["scheduled"] += 1
                state = logs.get((schedule.id, when))
                if state == MedicationLog.Status.TAKEN:
                    row["taken"] += 1
                elif state == MedicationLog.Status.SKIPPED:
                    row["skipped"] += 1
                else:
                    row["missed"] += 1
        for key in totals:
            totals[key] += row[key]
        history.append(row)
        day += timedelta(days=1)
    rate = round(totals["taken"] / totals["scheduled"] * 100, 1) if totals["scheduled"] else None
    return {"days": days, "totals": totals, "adherence_percent": rate, "history": history}
