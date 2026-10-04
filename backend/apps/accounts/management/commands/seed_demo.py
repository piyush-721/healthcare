"""Populate a realistic demo workspace for local exploration.

    python manage.py seed_demo            # create (idempotent: skips if present)
    python manage.py seed_demo --reset    # delete demo accounts first

Accounts (password ``Demo-Password-2026``):
    demo@healthos.local       — patient with a dependent child and full history
    caregiver@healthos.local  — adult child with caregiver access to the demo patient
    admin@healthos.local      — platform administrator (no health-data access)
"""

from __future__ import annotations

import io
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.appointments.models import Appointment, AppointmentNote
from apps.common.storage import get_private_storage
from apps.family.models import CaregiverAccess
from apps.labs.models import LabReport, LabResult
from apps.medications.models import Medication, MedicationLog, MedicationSchedule
from apps.profiles.access import Perm, normalize_permissions
from apps.profiles.models import (
    Allergy,
    EmergencyContact,
    MedicalCondition,
    VaccinationRecord,
    VitalRecord,
)
from apps.profiles.services import create_self_profile
from apps.records.models import CareProvider, MedicalDocument, MedicalRecord
from apps.treatments.models import TreatmentPlan, TreatmentTask

PASSWORD = "Demo-Password-2026"  # noqa: S105 - documented local demo credential
TZ = "Asia/Kolkata"
DEMO_EMAILS = ["demo@healthos.local", "caregiver@healthos.local", "admin@healthos.local"]
PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


class Command(BaseCommand):
    help = "Create demo accounts and sample health data."

    def add_arguments(self, parser):  # type: ignore[no-untyped-def]
        parser.add_argument("--reset", action="store_true", help="Delete demo accounts first.")

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        if options["reset"]:
            User.objects.filter(email__in=DEMO_EMAILS).delete()
        if User.objects.filter(email="demo@healthos.local", full_name="Priya Sharma").exists():
            self.stdout.write("Demo data already present (use --reset to recreate).")
            return
        User.objects.filter(email__in=DEMO_EMAILS).delete()
        with transaction.atomic():
            self._seed()
        self.stdout.write(
            self.style.SUCCESS(
                f"Demo ready. Sign in as demo@healthos.local / {PASSWORD} "
                "(also caregiver@healthos.local, admin@healthos.local)."
            )
        )

    def _user(self, email: str, name: str, **extra) -> User:  # type: ignore[no-untyped-def]
        user = User.objects.create_user(
            email=email,
            password=PASSWORD,
            full_name=name,
            email_verified_at=timezone.now(),
            timezone=TZ,
            **extra,
        )
        create_self_profile(user)
        return user

    def _seed(self) -> None:
        tz = ZoneInfo(TZ)
        now = timezone.now()
        today = now.astimezone(tz).date()

        def at(days: int, hour: int, minute: int = 0) -> datetime:
            return datetime.combine(today + timedelta(days=days), time(hour, minute), tzinfo=tz)

        demo = self._user("demo@healthos.local", "Priya Sharma")
        caregiver = self._user("caregiver@healthos.local", "Rohan Sharma")
        self._user("admin@healthos.local", "Ada Admin", role=User.Role.ADMIN)

        profile = demo.owned_profiles.get(is_self=True)
        profile.date_of_birth = today.replace(year=today.year - 58)
        profile.sex = "FEMALE"
        profile.blood_type = "B+"
        profile.height_cm = 162
        profile.city = "Pune"
        profile.country = "India"
        profile.save()

        EmergencyContact.objects.create(
            profile=profile,
            name="Rohan Sharma",
            relationship="Son",
            phone="+91 98200 11111",
            is_primary=True,
        )
        Allergy.objects.create(
            profile=profile, substance="Penicillin", reaction="Hives", severity="SEVERE"
        )
        MedicalCondition.objects.create(
            profile=profile,
            name="Type 2 diabetes",
            status="MANAGED",
            diagnosed_on=today - timedelta(days=900),
        )
        MedicalCondition.objects.create(
            profile=profile,
            name="Hypertension",
            status="ACTIVE",
            diagnosed_on=today - timedelta(days=400),
        )
        VaccinationRecord.objects.create(
            profile=profile,
            vaccine_name="Influenza",
            administered_on=today - timedelta(days=200),
            administered_by="City Clinic",
        )
        for i, (sys_bp, dia_bp) in enumerate([(138, 88), (134, 86), (131, 84), (129, 82)]):
            VitalRecord.objects.create(
                profile=profile,
                vital_type="BLOOD_PRESSURE",
                value=sys_bp,
                secondary_value=dia_bp,
                unit="mmHg",
                measured_at=now - timedelta(days=21 - i * 7),
            )
        VitalRecord.objects.create(
            profile=profile,
            vital_type="WEIGHT",
            value=68.4,
            unit="kg",
            measured_at=now - timedelta(days=2),
        )

        dr_mehta = CareProvider.objects.create(
            profile=profile,
            name="Dr. Anil Mehta",
            kind="DOCTOR",
            specialty="Endocrinology",
            organization="City Clinic",
            phone="+91 20 5555 0101",
        )
        dr_rao = CareProvider.objects.create(
            profile=profile,
            name="Dr. Kavita Rao",
            kind="DOCTOR",
            specialty="Cardiology",
            organization="Sahyadri Hospital",
        )
        lab = CareProvider.objects.create(profile=profile, name="Metro Diagnostics", kind="LAB")

        consult = MedicalRecord.objects.create(
            profile=profile,
            title="Diabetes review consultation",
            record_type="CONSULTATION",
            record_date=today - timedelta(days=10),
            provider=dr_mehta,
            created_by=demo,
            description="Quarterly review. Continue current medication; repeat HbA1c in 3 months.",
        )
        rx = MedicalRecord.objects.create(
            profile=profile,
            title="Prescription — Metformin & Amlodipine",
            record_type="PRESCRIPTION",
            record_date=today - timedelta(days=10),
            provider=dr_mehta,
            created_by=demo,
        )
        storage = get_private_storage()
        documents = {}
        for title, doc_type, record, days in [
            ("Prescription scan", "PRESCRIPTION", rx, 10),
            ("CBC & HbA1c report", "LAB_REPORT", None, 7),
            ("Pharmacy bill", "MEDICAL_BILL", None, 9),
        ]:
            key = storage.save(io.BytesIO(PDF), extension=".pdf")
            documents[doc_type] = MedicalDocument.objects.create(
                profile=profile,
                record=record,
                title=title,
                document_type=doc_type,
                document_date=today - timedelta(days=days),
                storage_key=key,
                original_filename=f"{title.lower().replace(' ', '-').replace('&', 'and')}.pdf",
                content_type="application/pdf",
                size_bytes=len(PDF),
                sha256="0" * 64,
                scan_status=MedicalDocument.ScanStatus.CLEAN,
                scanned_at=now,
                uploaded_by=demo,
            )

        metformin = Medication.objects.create(
            profile=profile,
            name="Metformin",
            dosage="500 mg",
            form="TABLET",
            frequency="TWICE_DAILY",
            instructions="After meals",
            start_date=today - timedelta(days=60),
            prescribed_by=dr_mehta,
            source_record=rx,
        )
        amlodipine = Medication.objects.create(
            profile=profile,
            name="Amlodipine",
            dosage="5 mg",
            form="TABLET",
            frequency="ONCE_DAILY",
            start_date=today - timedelta(days=30),
            prescribed_by=dr_rao,
        )
        Medication.objects.create(
            profile=profile,
            name="Paracetamol",
            dosage="500 mg",
            form="TABLET",
            frequency="AS_NEEDED",
            instructions="For fever or pain, as advised",
            start_date=today - timedelta(days=90),
        )
        Medication.objects.create(
            profile=profile,
            name="Azithromycin",
            dosage="500 mg",
            form="CAPSULE",
            frequency="THREE_TIMES_DAILY",
            status="COMPLETED",
            start_date=today - timedelta(days=120),
            end_date=today - timedelta(days=113),
        )
        schedules = [
            MedicationSchedule.objects.create(medication=metformin, time_of_day=time(8, 0)),
            MedicationSchedule.objects.create(medication=metformin, time_of_day=time(20, 0)),
            MedicationSchedule.objects.create(medication=amlodipine, time_of_day=time(9, 0)),
        ]
        for day in range(1, 15):
            for schedule in schedules:
                if (day + schedule.time_of_day.hour) % 9 == 0:
                    continue  # leave some doses unrecorded so adherence is realistic
                status = "SKIPPED" if day % 11 == 0 else "TAKEN"
                when = at(-day, schedule.time_of_day.hour)
                MedicationLog.objects.create(
                    medication=schedule.medication,
                    schedule=schedule,
                    scheduled_for=when,
                    status=status,
                    logged_by=demo,
                    taken_at=when if status == "TAKEN" else None,
                )

        follow_up = Appointment.objects.create(
            profile=profile,
            title="Diabetes follow-up",
            provider=dr_mehta,
            location="City Clinic, FC Road",
            scheduled_at=at(4, 11, 30),
            reason="HbA1c review",
            reminder_minutes_before=24 * 60,
        )
        Appointment.objects.create(
            profile=profile,
            title="Cardiology check-up",
            provider=dr_rao,
            kind="VIDEO",
            scheduled_at=at(12, 17, 0),
            reminder_minutes_before=60,
        )
        past = Appointment.objects.create(
            profile=profile,
            title="Diabetes review",
            provider=dr_mehta,
            location="City Clinic",
            scheduled_at=at(-10, 10, 0),
            status="COMPLETED",
        )
        AppointmentNote.objects.create(
            appointment=past,
            author=demo,
            body="Doctor asked to repeat blood tests before next visit.",
        )
        Appointment.objects.create(
            profile=profile,
            title="Eye examination",
            kind="IN_PERSON",
            provider_name="Vision Care Centre",
            scheduled_at=at(-2, 15, 0),
        )

        for days, hb, a1c, glucose in [
            (190, 12.4, 7.9, 148),
            (100, 12.9, 7.4, 136),
            (7, 13.2, 7.0, 124),
        ]:
            report = LabReport.objects.create(
                profile=profile,
                title="CBC & HbA1c",
                lab_name="Metro Diagnostics",
                report_date=today - timedelta(days=days),
                ordered_by=dr_mehta,
                document=documents["LAB_REPORT"] if days == 7 else None,
            )
            for name, value, unit, low, high in [
                ("Hemoglobin", hb, "g/dL", 12.0, 16.0),
                ("HbA1c", a1c, "%", 4.0, 5.6),
                ("Fasting glucose", glucose, "mg/dL", 70, 100),
            ]:
                LabResult.objects.create(
                    report=report,
                    test_name=name,
                    value=value,
                    unit=unit,
                    reference_low=low,
                    reference_high=high,
                )

        plan = TreatmentPlan.objects.create(
            profile=profile,
            title="Post-consultation follow-up",
            provider=dr_mehta,
            start_date=today - timedelta(days=10),
            next_review_date=today + timedelta(days=4),
            description="Steps agreed at the last diabetes review.",
        )
        for position, (title, kind, status, due) in enumerate(
            [
                ("Blood test (HbA1c, CBC)", "TEST", "DONE", -8),
                ("Upload lab report", "UPLOAD", "DONE", -6),
                ("Follow-up consultation", "FOLLOW_UP", "PENDING", 4),
                ("Start 30-minute daily walks", "TASK", "PENDING", 2),
            ]
        ):
            TreatmentTask.objects.create(
                plan=plan,
                title=title,
                kind=kind,
                status=status,
                position=position,
                due_date=today + timedelta(days=due),
                appointment=follow_up if kind == "FOLLOW_UP" else None,
                completed_at=now - timedelta(days=abs(due)) if status == "DONE" else None,
                completed_by=demo if status == "DONE" else None,
            )
        del lab, consult

        child = demo.owned_profiles.create(
            full_name="Aarav Sharma",
            relationship_to_owner="CHILD",
            date_of_birth=today.replace(year=today.year - 9),
            sex="MALE",
            blood_type="O+",
        )
        VaccinationRecord.objects.create(
            profile=child,
            vaccine_name="MMR",
            dose_number=2,
            administered_on=today - timedelta(days=700),
        )
        Appointment.objects.create(
            profile=child,
            title="Paediatric check-up",
            provider_name="Dr. Neha Joshi",
            scheduled_at=at(7, 10, 0),
        )

        CaregiverAccess.objects.create(
            profile=profile,
            granted_by=demo,
            caregiver=caregiver,
            invite_email=caregiver.email,
            relationship="Son",
            status=CaregiverAccess.Status.ACTIVE,
            accepted_at=now,
            permissions=normalize_permissions(
                [Perm.MANAGE_MEDICATIONS, Perm.MANAGE_APPOINTMENTS, Perm.VIEW_LAB_RESULTS]
            ),
            invite_expires_at=now + timedelta(days=7),
        )
