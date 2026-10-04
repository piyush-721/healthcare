import { Badge, type BadgeTone } from "@/components/ui";
import type { CreatedShare } from "@/types/api";

export type Scope = CreatedShare["scopes"][number];

export const SCOPES: { value: Scope; label: string; description: string }[] = [
  {
    value: "PROFILE",
    label: "Health profile",
    description: "Basics, allergies, conditions, vitals and vaccinations",
  },
  {
    value: "MEDICATIONS",
    label: "Medications",
    description: "Current and paused medications with schedules",
  },
  { value: "APPOINTMENTS", label: "Appointments", description: "Recent and upcoming appointments" },
  {
    value: "DOCUMENTS",
    label: "Records & documents",
    description: "Medical records and documents, excluding bills",
  },
  { value: "LAB_RESULTS", label: "Lab results", description: "Lab reports and their results" },
  {
    value: "TREATMENT_PLANS",
    label: "Treatment plans",
    description: "Active treatment plans and tasks",
  },
  { value: "FINANCIAL", label: "Medical bills", description: "Bills and payment documents" },
];

export const SCOPE_LABELS: Record<string, string> = Object.fromEntries(
  SCOPES.map((s) => [s.value, s.label]),
);

export const DEFAULT_SCOPES: Scope[] = SCOPES.map((s) => s.value).filter((s) => s !== "FINANCIAL");

export const DURATIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

const STATE_TONES: Record<string, BadgeTone> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  REVOKED: "danger",
};
const STATE_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

export function ShareStateBadge({ state }: { state: string }) {
  return <Badge tone={STATE_TONES[state] ?? "neutral"}>{STATE_LABELS[state] ?? state}</Badge>;
}

const OUTCOME_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  GRANTED: { label: "Granted", tone: "success" },
  DENIED_EXPIRED: { label: "Denied · expired", tone: "warning" },
  DENIED_REVOKED: { label: "Denied · revoked", tone: "danger" },
  DENIED_SCOPE: { label: "Denied · not shared", tone: "warning" },
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const meta = OUTCOME_LABELS[outcome] ?? { label: outcome, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const SECTION_LABELS: Record<string, string> = {
  summary: "Overview",
  profile: "Health profile",
  medications: "Medications",
  appointments: "Appointments",
  documents: "Documents",
  "lab-results": "Lab results",
  "treatment-plans": "Treatment plans",
  "document-download": "Document download",
};

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section.replace(/[-_]/g, " ");
}
