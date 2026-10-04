/** Display formatting. All dates render in the viewer's locale and time zone. */

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** Parse "YYYY-MM-DD" as a local calendar date (not UTC midnight). */
export function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function formatDate(value?: string | null): string {
  return value ? dateFmt.format(parseDate(value)) : "—";
}

export function formatDateTime(value?: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  if (/^\d{2}:\d{2}/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    return timeFmt.format(new Date(2000, 0, 1, h, m));
  }
  return timeFmt.format(new Date(value));
}

export function formatRelative(value?: string | null): string {
  if (!value) return "—";
  const diffMs = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 864e5],
    ["month", 30 * 864e5],
    ["week", 7 * 864e5],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return relativeFmt.format(Math.round(diffMs / ms), unit);
  }
  return "just now";
}

/** "MEDICAL_BILL" → "Medical bill" */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  const text = value.replace(/[_-]+/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Convert a `datetime-local` input value to an ISO string with the viewer's offset. */
export function localInputToISO(value: string): string {
  return new Date(value).toISOString();
}

/** ISO timestamp → value for `<input type="datetime-local">`. */
export function isoToLocalInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
