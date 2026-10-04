import { todayISO } from "@/lib/format";
import type { Medication } from "@/types/api";
import type { Req } from "@/services/types";

import {
  DEFAULT_TIMES,
  MAX_SCHEDULE_TIMES,
  toHHMM,
  type Frequency,
  type MedicationForm,
} from "./constants";

export type MedicationFormValues = {
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: Frequency;
  times: string[];
  days: number[];
  start_date: string;
  end_date: string;
  instructions: string;
  reminders_enabled: boolean;
  prescribed_by: string | null;
  notes: string;
};

export type MedicationPayload = Req<"MedicationRequest">;

export function initialMedicationValues(medication?: Medication): MedicationFormValues {
  if (!medication) {
    return {
      name: "",
      dosage: "",
      form: "TABLET",
      frequency: "ONCE_DAILY",
      times: [...(DEFAULT_TIMES.ONCE_DAILY ?? [])],
      days: [],
      start_date: todayISO(),
      end_date: "",
      instructions: "",
      reminders_enabled: true,
      prescribed_by: null,
      notes: "",
    };
  }
  const schedules = medication.schedules ?? [];
  return {
    name: medication.name,
    dosage: medication.dosage,
    form: medication.form ?? "TABLET",
    frequency: medication.frequency ?? "ONCE_DAILY",
    times: schedules.map((s) => toHHMM(s.time_of_day)).sort(),
    days: [...(schedules[0]?.days_of_week ?? [])].sort((a, b) => a - b),
    start_date: medication.start_date,
    end_date: medication.end_date ?? "",
    instructions: medication.instructions ?? "",
    reminders_enabled: medication.reminders_enabled ?? true,
    prescribed_by: medication.prescribed_by ?? null,
    notes: medication.notes ?? "",
  };
}

/** Times to show after the user picks a new frequency. */
export function timesForFrequency(frequency: Frequency, current: string[]): string[] {
  const suggested = DEFAULT_TIMES[frequency];
  return suggested === null ? current : [...suggested];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Client-side validation for UX; the server validates again. Keys match payload fields. */
export function validateMedication(values: MedicationFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = "Enter the medication name.";
  if (!values.dosage.trim()) errors.dosage = "Enter the dosage as prescribed.";
  if (!values.start_date) errors.start_date = "Choose a start date.";
  if (values.end_date && values.start_date && values.end_date < values.start_date) {
    errors.end_date = "End date can't be before the start date.";
  }
  if (values.frequency !== "AS_NEEDED") {
    if (values.times.length === 0) errors.schedules = "Add at least one time.";
    else if (values.times.some((t) => !TIME_RE.test(t)))
      errors.schedules = "Enter every time as HH:MM.";
    else if (new Set(values.times).size !== values.times.length)
      errors.schedules = "Each time must be different.";
    else if (values.times.length > MAX_SCHEDULE_TIMES)
      errors.schedules = `Use at most ${MAX_SCHEDULE_TIMES} times.`;
    else if (values.frequency === "WEEKLY" && values.days.length === 0) {
      errors.schedules = "Choose the day(s) of the week.";
    }
  }
  return errors;
}

/** Form values → API body. Schedules always replace the existing ones on PATCH. */
export function buildMedicationPayload(values: MedicationFormValues): MedicationPayload {
  const days = [...new Set(values.days)].sort((a, b) => a - b);
  const schedules =
    values.frequency === "AS_NEEDED"
      ? []
      : [...values.times].sort().map((time) => ({ time_of_day: time, days_of_week: days }));
  return {
    name: values.name.trim(),
    dosage: values.dosage.trim(),
    form: values.form,
    frequency: values.frequency,
    start_date: values.start_date,
    end_date: values.end_date || null,
    instructions: values.instructions.trim(),
    reminders_enabled: values.reminders_enabled,
    prescribed_by: values.prescribed_by,
    notes: values.notes.trim(),
    schedules,
  };
}
