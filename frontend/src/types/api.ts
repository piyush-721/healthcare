/**
 * Domain types. Generated from the backend OpenAPI schema (`npm run gen:api`)
 * so frontend and backend contracts stay in sync; only shapes the schema
 * cannot express (dict responses) are declared by hand below.
 */
import type { components } from "./openapi";

type Schemas = components["schemas"];

export type User = Schemas["User"];
export type AuthResponse = Schemas["AuthResponse"];
export type Session = Schemas["Session"];
export type AuditEntry = Schemas["AuditLog"];
export type AdminAuditEntry = Schemas["AdminAuditLog"];
export type AdminUser = Schemas["AdminUser"];
export type AdminUserDetail = Schemas["AdminUserDetail"];

export type PatientProfile = Schemas["PatientProfile"];
export type EmergencyContact = Schemas["EmergencyContact"];
export type Allergy = Schemas["Allergy"];
export type MedicalCondition = Schemas["MedicalCondition"];
export type VitalRecord = Schemas["VitalRecord"];
export type VaccinationRecord = Schemas["VaccinationRecord"];

export type CareProvider = Schemas["CareProvider"];
export type ProviderSummary = Schemas["ProviderSummary"];
export type MedicalRecord = Schemas["MedicalRecord"];
export type MedicalDocument = Schemas["MedicalDocument"];

export type Medication = Schemas["Medication"];
export type MedicationSchedule = Schemas["MedicationSchedule"];
export type MedicationLog = Schemas["MedicationLog"];
export type TodayDose = Schemas["TodayDose"];

export type Appointment = Schemas["Appointment"];
export type AppointmentNote = Schemas["AppointmentNote"];

export type LabReport = Schemas["LabReport"];
export type LabResult = Schemas["LabResult"];
export type TrendPoint = Schemas["TrendPoint"];

export type TreatmentPlan = Schemas["TreatmentPlan"];
export type TreatmentTask = Schemas["TreatmentTask"];

export type CaregiverAccess = Schemas["CaregiverAccess"];
export type DataShare = Schemas["DataShare"];
export type CreatedShare = Schemas["CreatedShare"];
export type ShareAccessLog = Schemas["ShareAccessLog"];
export type ShareSummary = Schemas["ShareSummary"];

export type Notification = Schemas["Notification"];
export type NotificationPreference = Schemas["NotificationPreference"];

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const PERMISSIONS = [
  "VIEW_PROFILE",
  "MANAGE_PROFILE",
  "VIEW_MEDICATIONS",
  "MANAGE_MEDICATIONS",
  "VIEW_APPOINTMENTS",
  "MANAGE_APPOINTMENTS",
  "VIEW_DOCUMENTS",
  "UPLOAD_DOCUMENTS",
  "VIEW_LAB_RESULTS",
  "MANAGE_LAB_RESULTS",
  "VIEW_TREATMENT_PLANS",
  "MANAGE_TREATMENT_PLANS",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type TimelineEvent = {
  id: string;
  type: string;
  occurred_at: string;
  all_day: boolean;
  title: string;
  subtitle: string;
  resource: string;
  resource_id: string;
  status: string;
};

export type TimelinePage = {
  results: TimelineEvent[];
  next_cursor: string | null;
  available_types: string[];
};

export type Adherence = {
  days: number;
  totals: { scheduled: number; taken: number; skipped: number; missed: number };
  adherence_percent: number | null;
  history: { date: string; scheduled: number; taken: number; skipped: number; missed: number }[];
};

export type TodayDoses = { date: string; timezone: string; doses: TodayDose[] };

export type LabTestSummary = {
  test_key: string;
  test_name: string;
  unit: string;
  count: number;
  latest: string;
};

export type FamilyOverview = {
  dependents: PatientProfile[];
  caregivers: CaregiverAccess[];
  caring_for: CaregiverAccess[];
  pending_invitations: CaregiverAccess[];
};

export type Dashboard = {
  profile: {
    id: string;
    full_name: string;
    is_self: boolean;
    access_role: string;
    permissions: Permission[];
  };
  date: string;
  upcoming_appointments:
    | {
        id: string;
        title: string;
        scheduled_at: string;
        provider: string;
        location: string;
        kind: string;
      }[]
    | null;
  appointments_needing_update: number | null;
  todays_doses: TodayDose[] | null;
  pending_tasks:
    | {
        id: string;
        title: string;
        kind: string;
        due_date: string | null;
        plan_id: string;
        plan_title: string;
        overdue: boolean;
      }[]
    | null;
  recent_lab_reports:
    | { id: string; title: string; report_date: string; lab_name: string; result_count: number }[]
    | null;
  recent_events: TimelineEvent[];
  family: { dependents: number; caregivers: number; caring_for: number };
  unread_notifications: number;
};

export type AdminStats = {
  users: Record<
    | "total"
    | "active"
    | "deactivated"
    | "suspended"
    | "unverified"
    | "admins"
    | "new_7d"
    | "new_30d",
    number
  >;
  active_sessions: number;
  audit_last_24h: {
    total: number;
    failed_logins: number;
    token_reuse: number;
    share_denials: number;
  };
};

export type SharedSection =
  "profile" | "medications" | "appointments" | "documents" | "lab-results" | "treatment-plans";
