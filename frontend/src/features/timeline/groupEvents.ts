import type { TimelineEvent } from "@/types/api";

export type DayGroup = { day: string; label: string; events: TimelineEvent[] };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendar day of an event in the viewer's zone. All-day events are dated by
 * the profile's own calendar (the date part as sent) so they never shift days.
 */
export function eventDay(event: TimelineEvent): string {
  if (event.all_day) return event.occurred_at.slice(0, 10);
  const d = new Date(event.occurred_at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Sat, 4 Oct 2026" */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const parts = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

/** Group events (already sorted newest first) by calendar day, preserving order. */
export function groupByDay(events: TimelineEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  for (const event of events) {
    const day = eventDay(event);
    let group = index.get(day);
    if (!group) {
      group = { day, label: formatDayLabel(day), events: [] };
      index.set(day, group);
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

/** Future events (e.g. upcoming appointments) vs. today and earlier. */
export function isUpcoming(event: TimelineEvent, now: Date, today: string): boolean {
  if (event.all_day) return eventDay(event) > today;
  return new Date(event.occurred_at).getTime() > now.getTime();
}

/** Merge pages, dropping duplicates that can appear when data changes between requests. */
export function mergeEvents(pages: TimelineEvent[][]): TimelineEvent[] {
  const seen = new Set<string>();
  const result: TimelineEvent[] = [];
  for (const page of pages) {
    for (const event of page) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      result.push(event);
    }
  }
  return result;
}
