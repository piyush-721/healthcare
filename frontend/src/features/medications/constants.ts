import type { BadgeTone } from "@/components/ui";
import type { Medication } from "@/types/api";

export type MedicationForm = NonNullable<Medication["form"]>;
export type Frequency = NonNullable<Medication["frequency"]>;
export type MedicationStatus = Medication["status"];

export const FORMS = [
  "TABLET",
  "CAPSULE",
  "LIQUID",
  "INJECTION",
  "INHALER",
  "TOPICAL",
  "DROPS",
  "OTHER",
] as const satisfies readonly MedicationForm[];

export const FREQUENCIES = [
  "ONCE_DAILY",
  "TWICE_DAILY",
  "THREE_TIMES_DAILY",
  "FOUR_TIMES_DAILY",
  "WEEKLY",
  "AS_NEEDED",
  "CUSTOM",
] as const satisfies readonly Frequency[];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  ONCE_DAILY: "Once daily",
  TWICE_DAILY: "Twice daily",
  THREE_TIMES_DAILY: "Three times daily",
  FOUR_TIMES_DAILY: "Four times daily",
  WEEKLY: "Weekly",
  AS_NEEDED: "As needed",
  CUSTOM: "Custom schedule",
};

/** Suggested starting times per frequency; users can change them freely. */
export const DEFAULT_TIMES: Record<Frequency, string[] | null> = {
  ONCE_DAILY: ["08:00"],
  TWICE_DAILY: ["08:00", "20:00"],
  THREE_TIMES_DAILY: ["08:00", "14:00", "20:00"],
  FOUR_TIMES_DAILY: ["08:00", "12:00", "16:00", "20:00"],
  WEEKLY: ["09:00"],
  AS_NEEDED: [],
  CUSTOM: null, // keep whatever the user already has
};

/** Index matches the backend's `date.weekday()` (Monday = 0). */
export const WEEKDAYS = [
  { value: 0, short: "Mon", long: "Monday" },
  { value: 1, short: "Tue", long: "Tuesday" },
  { value: 2, short: "Wed", long: "Wednesday" },
  { value: 3, short: "Thu", long: "Thursday" },
  { value: 4, short: "Fri", long: "Friday" },
  { value: 5, short: "Sat", long: "Saturday" },
  { value: 6, short: "Sun", long: "Sunday" },
] as const;

export const MAX_SCHEDULE_TIMES = 12;

export const MEDICATION_STATUS: Record<MedicationStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  PAUSED: { label: "Paused", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  STOPPED: { label: "Stopped", tone: "neutral" },
};

export const DOSE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  TAKEN: { label: "Taken", tone: "success" },
  SKIPPED: { label: "Skipped", tone: "neutral" },
  MISSED: { label: "Missed", tone: "warning" },
  PENDING: { label: "Upcoming", tone: "info" },
  OVERDUE: { label: "Overdue", tone: "warning" },
};

export const MEDICATION_DISCLAIMER =
  "HealthOS records your medications exactly as prescribed and never recommends changes. Talk to your doctor or pharmacist before changing how you take any medication.";

export function describeDays(days: readonly number[] | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d]?.short ?? "")
    .filter(Boolean)
    .join(", ");
}

/** "08:00:00" → "08:00" */
export const toHHMM = (time: string) => time.slice(0, 5);
