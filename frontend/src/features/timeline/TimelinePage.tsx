"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FileUp,
  FlaskConical,
  HeartPulse,
  History,
  Pill,
  PillBottle,
  SearchX,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/cn";
import { formatTime, humanize, todayISO } from "@/lib/format";
import { resourceHref } from "@/lib/routes";
import { useLazyTimelineQuery, useTimelineQuery, type TimelineArgs } from "@/services/timeline";
import type { TimelineEvent } from "@/types/api";

import { groupByDay, isUpcoming, mergeEvents, type DayGroup } from "./groupEvents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export const PAGE_SIZE = 30;

export const EVENT_TYPES: Record<string, { label: string; icon: LucideIcon }> = {
  APPOINTMENT: { label: "Appointments", icon: CalendarDays },
  MEDICATION_STARTED: { label: "Medication started", icon: Pill },
  MEDICATION_ENDED: { label: "Medication ended", icon: PillBottle },
  RECORD: { label: "Records", icon: FileText },
  DOCUMENT_UPLOADED: { label: "Documents", icon: FileUp },
  LAB_REPORT: { label: "Lab reports", icon: FlaskConical },
  TREATMENT_PLAN: { label: "Treatment plans", icon: ClipboardList },
  TREATMENT_TASK_DONE: { label: "Tasks completed", icon: CheckCircle2 },
  VACCINATION: { label: "Vaccinations", icon: Syringe },
  CONDITION: { label: "Conditions", icon: HeartPulse },
};

const typeInfo = (type: string) => EVENT_TYPES[type] ?? { label: humanize(type), icon: History };

function EventItem({ event }: { event: TimelineEvent }) {
  const { label, icon: Icon } = typeInfo(event.type);
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span
        className="absolute top-9 bottom-0 left-[17px] w-px bg-slate-200 group-last:hidden"
        aria-hidden
      />
      <span className="border-brand-100 bg-brand-50 text-brand-700 relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border">
        <Icon className="size-4" aria-hidden />
      </span>
      <Link
        href={resourceHref(event.resource, event.resource_id)}
        className="hover:border-brand-200 hover:bg-brand-50/30 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          {!event.all_day && (
            <time dateTime={event.occurred_at} className="text-xs text-slate-500">
              · {formatTime(event.occurred_at)}
            </time>
          )}
          {event.status && <Badge tone="neutral">{humanize(event.status)}</Badge>}
        </div>
        <p className="mt-0.5 font-medium text-slate-900">{event.title}</p>
        {event.subtitle && <p className="text-sm text-slate-600">{event.subtitle}</p>}
      </Link>
    </li>
  );
}

function DaySection({ group }: { group: DayGroup }) {
  return (
    <section aria-labelledby={`day-${group.day}`} className="space-y-3">
      <h3 id={`day-${group.day}`} className="text-sm font-semibold text-slate-700">
        <time dateTime={group.day}>{group.label}</time>
      </h3>
      <ol className="space-y-0">
        {group.events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
      </ol>
    </section>
  );
}

function TimelineFeed({ args, filtered }: { args: TimelineArgs; filtered: boolean }) {
  const toast = useToast();
  const first = useTimelineQuery(args);
  const [trigger, { isFetching: loadingMore }] = useLazyTimelineQuery();
  const [pages, setPages] = useState<{ events: TimelineEvent[]; cursor: string | null }[]>([]);

  const cursor = pages.length ? pages[pages.length - 1].cursor : (first.data?.next_cursor ?? null);
  const events = useMemo(
    () => mergeEvents([first.data?.results ?? [], ...pages.map((p) => p.events)]),
    [first.data, pages],
  );
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const today = todayISO();
    const up: TimelineEvent[] = [];
    const rest: TimelineEvent[] = [];
    for (const e of events) (isUpcoming(e, now, today) ? up : rest).push(e);
    // Upcoming reads soonest first.
    return { upcoming: groupByDay([...up].reverse()), past: groupByDay(rest) };
  }, [events]);

  if (first.isLoading) return <LoadingState label="Loading timeline…" />;
  if (first.error) return <ErrorState error={first.error} onRetry={() => void first.refetch()} />;
  if (events.length === 0) {
    return filtered ? (
      <EmptyState
        icon={SearchX}
        title="No events match these filters"
        description="Try other event types, a wider date range or a different search."
      />
    ) : (
      <EmptyState
        icon={History}
        title="Your timeline is empty"
        description="As you add appointments, medications, records and lab reports, they'll appear here in date order."
      />
    );
  }

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const page = await trigger({ ...args, cursor }).unwrap();
      setPages((prev) => [...prev, { events: page.results, cursor: page.next_cursor }]);
    } catch (err) {
      toast.error(err, "Couldn't load more events.");
    }
  };

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <div className="border-brand-200 bg-brand-50/40 space-y-4 rounded-xl border border-dashed p-4">
          <h2 className="text-brand-800 text-xs font-semibold tracking-wide uppercase">Upcoming</h2>
          {upcoming.map((group) => (
            <DaySection key={group.day} group={group} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Past</h2>
          )}
          {past.map((group) => (
            <DaySection key={group.day} group={group} />
          ))}
        </div>
      )}
      {cursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} loading={loadingMore}>
            Load more
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500">
          You&apos;ve reached the beginning of this timeline.
        </p>
      )}
    </div>
  );
}

function TimelineContent({ profileId }: { profileId: string | undefined }) {
  const [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  // Unfiltered probe so the chips stay stable while filters change (cheap: limit 1).
  const typesQuery = useTimelineQuery({ profile: profileId, limit: 1 });
  const available = typesQuery.data?.available_types ?? [];
  const rangeInvalid = Boolean(from && to && from > to);

  const args: TimelineArgs = {
    profile: profileId,
    types: types.length ? types.join(",") : undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
    limit: PAGE_SIZE,
  };
  const filtered = Boolean(args.types || args.from || args.to || args.q);

  const toggle = (type: string) =>
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));

  return (
    <>
      <PageHeader
        title="Timeline"
        description="Everything in your health history, in one place, in date order."
      />
      <div className="space-y-6">
        <Card>
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Search" className="sm:col-span-2">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles and details…"
                />
              </Field>
              <Field label="From">
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field
                label="To"
                error={rangeInvalid ? "Must be on or after the From date." : undefined}
              >
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            {available.length > 0 && (
              <div role="group" aria-label="Event types" className="flex flex-wrap gap-2">
                {available.map((type) => {
                  const { label, icon: Icon } = typeInfo(type);
                  const pressed = types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => toggle(type)}
                      className={cn(
                        "focus-visible:outline-brand-600 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                        pressed
                          ? "border-brand-700 bg-brand-700 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {pressed ? (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      ) : (
                        <Icon className="size-3.5" aria-hidden />
                      )}
                      {label}
                    </button>
                  );
                })}
                {(types.length > 0 || from || to || search) && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setTypes([]);
                      setFrom("");
                      setTo("");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {rangeInvalid ? (
          <Alert tone="warning">Choose a From date that is on or before the To date.</Alert>
        ) : (
          // Keyed by filters so accumulated pages reset whenever they change.
          <TimelineFeed key={JSON.stringify(args)} args={args} filtered={filtered} />
        )}
      </div>
    </>
  );
}

export function TimelinePage() {
  const { profileId } = useActiveProfile();
  return <TimelineContent key={profileId ?? "self"} profileId={profileId} />;
}
