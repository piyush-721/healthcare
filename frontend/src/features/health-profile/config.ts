import { toOptions } from "@/components/ui";
import type { VitalRecord } from "@/types/api";

import type { FieldDef, FormValues } from "./RecordForm";

export const SEXES = ["FEMALE", "MALE", "INTERSEX", "UNDISCLOSED"] as const;
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"] as const;
export const SEVERITIES = ["MILD", "MODERATE", "SEVERE", "UNKNOWN"] as const;
export const CONDITION_STATUSES = ["ACTIVE", "MANAGED", "RESOLVED"] as const;
export const PROVIDER_KINDS = ["DOCTOR", "CLINIC", "HOSPITAL", "LAB", "PHARMACY", "OTHER"] as const;

export type VitalType = VitalRecord["vital_type"];
export const VITAL_TYPES: VitalType[] = [
  "BLOOD_PRESSURE",
  "HEART_RATE",
  "WEIGHT",
  "TEMPERATURE",
  "BLOOD_GLUCOSE",
  "OXYGEN_SATURATION",
  "RESPIRATORY_RATE",
];

export const VITAL_LABELS: Record<VitalType, string> = {
  BLOOD_PRESSURE: "Blood pressure",
  HEART_RATE: "Heart rate",
  WEIGHT: "Weight",
  TEMPERATURE: "Temperature",
  BLOOD_GLUCOSE: "Blood glucose",
  OXYGEN_SATURATION: "Oxygen saturation",
  RESPIRATORY_RATE: "Respiratory rate",
};

/** Suggested unit when a vital type is picked; the user can change it. */
export const DEFAULT_VITAL_UNITS: Record<VitalType, string> = {
  BLOOD_PRESSURE: "mmHg",
  HEART_RATE: "bpm",
  WEIGHT: "kg",
  TEMPERATURE: "°C",
  BLOOD_GLUCOSE: "mg/dL",
  OXYGEN_SATURATION: "%",
  RESPIRATORY_RATE: "breaths/min",
};

export const SEX_LABELS: Record<string, string> = { UNDISCLOSED: "Prefer not to say" };
export const BLOOD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BLOOD_TYPES.map((t) => [t, t === "UNKNOWN" ? "Unknown" : t]),
);

/** "120.00" → "120", "36.60" → "36.6". Display only — never interpreted. */
export function formatNumber(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value);
}

export function formatVital(
  vital: Pick<VitalRecord, "vital_type" | "value" | "secondary_value" | "unit">,
): string {
  const main =
    vital.vital_type === "BLOOD_PRESSURE" && vital.secondary_value
      ? `${formatNumber(vital.value)}/${formatNumber(vital.secondary_value)}`
      : formatNumber(vital.value);
  return vital.unit ? `${main} ${vital.unit}` : main;
}

const isBP = (values: FormValues) => values.vital_type === "BLOOD_PRESSURE";

export const PROFILE_FIELDS: FieldDef[] = [
  { name: "date_of_birth", label: "Date of birth", kind: "date" },
  { name: "sex", label: "Sex", kind: "select", options: toOptions(SEXES, SEX_LABELS) },
  {
    name: "blood_type",
    label: "Blood type",
    kind: "select",
    options: toOptions(BLOOD_TYPES, BLOOD_TYPE_LABELS),
  },
  { name: "height_cm", label: "Height (cm)", kind: "number", step: "0.1", min: "0" },
  { name: "phone", label: "Phone", kind: "tel" },
  { name: "address", label: "Address", kind: "text", full: true },
  { name: "city", label: "City", kind: "text" },
  { name: "country", label: "Country", kind: "text" },
  {
    name: "notes",
    label: "Notes",
    kind: "textarea",
    placeholder: "Anything you want to keep handy",
  },
];

export const ALLERGY_FIELDS: FieldDef[] = [
  {
    name: "substance",
    label: "Substance",
    kind: "text",
    required: true,
    placeholder: "e.g. Penicillin",
  },
  {
    name: "severity",
    label: "Severity (as recorded)",
    kind: "select",
    options: toOptions(SEVERITIES),
  },
  { name: "reaction", label: "Reaction", kind: "text", placeholder: "e.g. Rash" },
  { name: "noted_on", label: "Noted on", kind: "date" },
  { name: "notes", label: "Notes", kind: "textarea" },
];

export const CONDITION_FIELDS: FieldDef[] = [
  { name: "name", label: "Condition", kind: "text", required: true, full: true },
  { name: "status", label: "Status", kind: "select", options: toOptions(CONDITION_STATUSES) },
  { name: "diagnosed_on", label: "Diagnosed on", kind: "date" },
  {
    name: "resolved_on",
    label: "Resolved on",
    kind: "date",
    visible: (values) => values.status === "RESOLVED",
  },
  { name: "notes", label: "Notes", kind: "textarea" },
];

export const VITAL_FIELDS: FieldDef[] = [
  {
    name: "vital_type",
    label: "Measurement",
    kind: "select",
    required: true,
    options: VITAL_TYPES.map((t) => ({ value: t, label: VITAL_LABELS[t] })),
  },
  { name: "measured_at", label: "Measured at", kind: "datetime", required: true },
  {
    name: "value",
    label: "Value",
    labelFor: (values) => (isBP(values) ? "Systolic (top number)" : "Value"),
    kind: "number",
    required: true,
    step: "any",
    min: "0",
  },
  {
    name: "secondary_value",
    label: "Diastolic (bottom number)",
    kind: "number",
    required: true,
    step: "any",
    min: "0",
    visible: isBP,
  },
  { name: "unit", label: "Unit", kind: "text", required: true },
  {
    name: "notes",
    label: "Notes",
    kind: "text",
    full: true,
    placeholder: "e.g. After a morning walk",
  },
];

export const VACCINATION_FIELDS: FieldDef[] = [
  { name: "vaccine_name", label: "Vaccine", kind: "text", required: true },
  { name: "dose_number", label: "Dose number", kind: "number", step: "1", min: "1" },
  { name: "administered_on", label: "Date given", kind: "date", required: true },
  { name: "administered_by", label: "Given by", kind: "text", placeholder: "Clinic or person" },
  { name: "lot_number", label: "Lot number", kind: "text" },
  { name: "next_dose_due", label: "Next dose due", kind: "date" },
  { name: "notes", label: "Notes", kind: "textarea" },
];

export const CONTACT_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", kind: "text", required: true },
  { name: "relationship", label: "Relationship", kind: "text", placeholder: "e.g. Sister" },
  { name: "phone", label: "Phone", kind: "tel", required: true },
  { name: "email", label: "Email", kind: "email" },
  {
    name: "is_primary",
    label: "Primary contact",
    kind: "checkbox",
    hint: "Shown first when someone needs to reach a contact.",
  },
];

export const PROVIDER_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", kind: "text", required: true, placeholder: "Dr. Sharma" },
  { name: "kind", label: "Type", kind: "select", options: toOptions(PROVIDER_KINDS) },
  { name: "specialty", label: "Specialty", kind: "text" },
  { name: "organization", label: "Clinic / hospital", kind: "text" },
  { name: "phone", label: "Phone", kind: "tel" },
  { name: "email", label: "Email", kind: "email" },
  { name: "address", label: "Address", kind: "text", full: true },
  { name: "notes", label: "Notes", kind: "textarea" },
];

export function validateCondition(values: FormValues): Record<string, string> {
  const { diagnosed_on: from, resolved_on: to, status } = values;
  if (
    status === "RESOLVED" &&
    typeof from === "string" &&
    typeof to === "string" &&
    from &&
    to &&
    to < from
  ) {
    return { resolved_on: "Resolved date can't be before the diagnosed date." };
  }
  return {};
}

/** Picking a vital type pre-fills its usual unit. */
export function vitalTransform(values: FormValues, changed: string): FormValues {
  if (changed !== "vital_type" || typeof values.vital_type !== "string") return values;
  const unit = DEFAULT_VITAL_UNITS[values.vital_type as VitalType];
  return unit ? { ...values, unit } : values;
}
