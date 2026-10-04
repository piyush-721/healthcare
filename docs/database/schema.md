# Database schema

PostgreSQL 16, managed through Django migrations (`backend/apps/*/migrations`).

## Conventions

- **Identifiers:** every externally exposed row uses a random UUID primary key, so sequential IDs
  are never exposed and can't be enumerated. Internal-only tables (`NotificationPreference`,
  `ShareAccessLog`) use bigint keys.
- **Timestamps:** `created_at` (indexed) and `updated_at` on all domain tables.
- **Ownership:** every health record has a `profile_id` FK to `PatientProfile`, directly or through
  its parent (`LabResult → LabReport`, `TreatmentTask → TreatmentPlan`, `MedicationSchedule →
  Medication`).
- **Deletion:** hard deletes cascade from the profile. Soft deletion is used only where it's
  justified: `MedicalDocument.archived_at` (users archive documents without losing them). Audit rows
  keep `profile_id` as a plain UUID, so they outlive deleted profiles.
- **Postgres features:** `ArrayField` for small closed sets (caregiver permissions, share scopes,
  schedule weekdays), plus partial unique indexes and check constraints.

## Entity relationships

```text
User 1─* AuthSession
User 1─* AccountToken
User 1─* PatientProfile (owner)            ── exactly one is_self=True per owner
PatientProfile 1─* CaregiverAccess *─1 User (caregiver)
PatientProfile 1─* EmergencyContact | Allergy | MedicalCondition | VitalRecord | VaccinationRecord
PatientProfile 1─* CareProvider
PatientProfile 1─* MedicalRecord *─? CareProvider
PatientProfile 1─* MedicalDocument *─? MedicalRecord
PatientProfile 1─* Medication 1─* MedicationSchedule
                   Medication 1─* MedicationLog *─? MedicationSchedule
PatientProfile 1─* Appointment 1─* AppointmentNote
PatientProfile 1─* LabReport 1─* LabResult ;  LabReport *─? MedicalDocument
PatientProfile 1─* TreatmentPlan 1─* TreatmentTask *─? Appointment
PatientProfile 1─* DataShare 1─* ShareAccessLog
User 1─* Notification ; User 1─* NotificationPreference
AuditLog: actor?/subject_user? → User (SET NULL), profile_id (plain UUID)
```

## Tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `accounts_user` | email (unique, case-insensitive), role USER/ADMIN, status ACTIVE/DEACTIVATED/SUSPENDED, email_verified_at, timezone | Custom user model; no Django admin/permissions tables used |
| `accounts_authsession` | user, token_hash (unique), previous_token_hash, rotated_at, expires_at, revoked_at | One row per device login; refresh rotation |
| `accounts_accounttoken` | user, purpose, token_hash (unique), expires_at, used_at | Single-use email links |
| `profiles_patientprofile` | owner, is_self, relationship_to_owner, demographics | Subject of all health data |
| `family_caregiveraccess` | profile, caregiver, invite_email, permissions[], status, expires_at | Explicit, scoped grants |
| `records_careprovider` | profile, kind, name, specialty, organization | Per-profile care network |
| `records_medicalrecord` | profile, record_type, record_date, provider | |
| `records_medicaldocument` | profile, record, storage_key (unique), sha256, size_bytes, scan_status, archived_at | File bytes in private storage |
| `medications_medication` | profile, dosage, frequency, start/end dates, status | |
| `medications_medicationschedule` | medication, time_of_day, days_of_week[] | |
| `medications_medicationlog` | medication, schedule, scheduled_for, status | |
| `appointments_appointment` | profile, scheduled_at, status, reminder_minutes_before, reminder_sent_at | |
| `labs_labreport` / `labs_labresult` | report_date / test_key, value, value_text, reference range, source | `source` marks future machine-extracted values |
| `treatments_treatmentplan` / `_treatmenttask` | status, next_review_date / kind, status, due_date | |
| `sharing_datashare` | profile, scopes[], token_hash (unique), expires_at, revoked_at, access_count | |
| `sharing_shareaccesslog` | share, outcome, section, ip, user_agent | Every attempt |
| `notifications_notification` | user, category, show_in_app, read_at, emailed_at, dedupe_key | |
| `notifications_notificationpreference` | user, category, email_enabled, in_app_enabled | |
| `audit_auditlog` | event_type, actor, subject_user, profile_id, target, ip, request_id, metadata | Immutable in application code |

## Constraints

| Constraint | Purpose |
| --- | --- |
| `accounts_user_email_ci_unique` (UNIQUE on `lower(email)`) | No case-variant duplicate accounts |
| `profiles_one_self_per_owner` (partial unique) | Exactly one self-profile per account |
| `profiles_self_relationship_consistent` (check) | Self profile ⇔ relationship SELF |
| `profiles_condition_dates_ordered`, `meds_end_after_start`, `labs_reference_range_ordered` (checks) | Date/range sanity enforced in the DB as well as serializers |
| `family_one_active_grant_per_caregiver`, `family_one_pending_invite_per_email` (partial unique) | No duplicate grants or invitations |
| `family_active_grant_has_caregiver` (check) | An ACTIVE grant always has a caregiver user |
| `meds_schedule_unique_time`, `meds_log_one_per_dose` | One log per scheduled dose (idempotent dose logging) |
| `labs_result_has_value` (check) | Each result has a numeric or text value |
| `notif_dedupe_key_unique` (partial unique) | Exactly-once reminders across worker runs |
| `records_doc_size_gt_0`, `profiles_vital_value_gte_0` (checks) | Basic value sanity |

## Indexing decisions

Indexes follow the actual query patterns. Almost every list is "this profile's items, newest
first" or "items due soon".

| Index | Serves |
| --- | --- |
| `(profile, -record_date)`, `(profile, record_type)` on records | Record lists and filters, timeline |
| `(profile, -created_at) WHERE archived_at IS NULL` on documents | Active document list (partial index stays small) |
| `(profile, status)`, `(profile, -start_date)` on medications | Active medications, today's doses, timeline |
| `(medication, -scheduled_for)` on medication logs | Dose status lookup, adherence history |
| `(profile, status, scheduled_at)` on appointments | Upcoming/past views, dashboard |
| `(scheduled_at) WHERE status='SCHEDULED' AND reminder_sent_at IS NULL` | Reminder scan touches only pending rows |
| `(due_date) WHERE status='PENDING'` on treatment tasks | Dashboard pending tasks |
| `test_key` on lab results, `(profile, -report_date)` on reports | Trend queries |
| `(caregiver, status)`, `(profile, status)`, `(invite_email, status)` on caregiver grants | Access resolution on every request; invitation lookup |
| `token_hash` unique on sessions/account tokens/shares | O(1) token lookup |
| `(user, show_in_app, -created_at)`, partial unread index on notifications | Feed and unread badge |
| `(actor|subject_user|profile_id|event_type, -created_at)` on audit log | Security activity, admin filters |
