import type { BadgeTone } from "@/components/ui";
import type { Appointment } from "@/types/api";

export type AppointmentKind = NonNullable<Appointment["kind"]>;

export const KINDS = ["IN_PERSON", "VIDEO", "PHONE"] as const satisfies readonly AppointmentKind[];

export const KIND_LABELS: Record<AppointmentKind, string> = {
  IN_PERSON: "In person",
  VIDEO: "Video call",
  PHONE: "Phone call",
};

export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
];

export function reminderLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "No reminder";
  return (
    REMINDER_OPTIONS.find((o) => o.value === String(minutes))?.label ?? `${minutes} minutes before`
  );
}

export function appointmentStatus(appointment: Pick<Appointment, "status" | "needs_update">): {
  label: string;
  tone: BadgeTone;
} {
  switch (appointment.status) {
    case "SCHEDULED":
      return appointment.needs_update
        ? { label: "Needs update", tone: "warning" }
        : { label: "Upcoming", tone: "brand" };
    case "COMPLETED":
      return { label: "Completed", tone: "success" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    case "MISSED":
      return { label: "Missed", tone: "warning" };
    default:
      return { label: String(appointment.status), tone: "neutral" };
  }
}

export function providerLabel(
  appointment: Pick<Appointment, "provider_detail" | "provider_name">,
): string {
  return appointment.provider_detail?.name || appointment.provider_name || "";
}

/** Local calendar day ("YYYY-MM-DD") of an ISO timestamp, in the viewer's time zone. */
export function localDayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDayHeading(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
