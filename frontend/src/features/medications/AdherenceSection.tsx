"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader, EmptyState, QueryState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate, parseDate } from "@/lib/format";
import { useAdherenceQuery } from "@/services/medications";
import type { Adherence } from "@/types/api";

const RANGES = [7, 30, 90] as const;

/** Colours validated for colour-vision deficiency; "missed" also carries a stripe texture. */
const SERIES = [
  { key: "taken", label: "Taken", color: "#0d9488", pattern: undefined },
  { key: "skipped", label: "Skipped", color: "#6366f1", pattern: undefined },
  {
    key: "missed",
    label: "Missed",
    color: "#d97706",
    pattern: "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px)",
  },
] as const;

type Day = Adherence["history"][number];

export function AdherenceSection({ medicationId }: { medicationId: string }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const query = useAdherenceQuery({ id: medicationId, days });

  return (
    <Card>
      <CardHeader
        title="Dose history overview"
        description="How scheduled doses were logged over time."
        action={
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex rounded-lg border border-slate-300 p-0.5"
          >
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => setDays(range)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  days === range ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {range} days
              </button>
            ))}
          </div>
        }
      />
      <CardBody>
        <QueryState
          query={query}
          isEmpty={(data) => data.totals.scheduled === 0}
          empty={
            <EmptyState
              icon={BarChart3}
              title="No scheduled doses in this period"
              description="Once scheduled doses come due, a summary of how they were logged appears here."
            />
          }
        >
          {(data) => <AdherenceSummary data={data} />}
        </QueryState>
      </CardBody>
    </Card>
  );
}

function AdherenceSummary({ data }: { data: Adherence }) {
  const { totals } = data;
  const max = Math.max(1, ...data.history.map((d) => d.scheduled));
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Logged as taken"
          value={data.adherence_percent === null ? "—" : `${Math.round(data.adherence_percent)}%`}
        />
        <Stat label="Taken" value={`${totals.taken} of ${totals.scheduled}`} />
        <Stat label="Skipped" value={String(totals.skipped)} />
        <Stat label="Missed" value={String(totals.missed)} />
      </dl>

      <figure className="space-y-2">
        <figcaption className="sr-only">
          Daily doses over the last {data.days} days. Full numbers are in the table below.
        </figcaption>
        <div aria-hidden className="flex h-32 items-end gap-px border-b border-slate-200">
          {data.history.map((day) => (
            <DayBar key={day.date} day={day} max={max} />
          ))}
        </div>
        <div aria-hidden className="flex justify-between text-xs text-slate-500">
          <span>{data.history[0] ? formatDate(data.history[0].date) : ""}</span>
          <span>{data.history.at(-1) ? formatDate(data.history.at(-1)?.date) : ""}</span>
        </div>
        <ul className="flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-3 rounded-sm"
                style={{ backgroundColor: s.color, backgroundImage: s.pattern }}
              />
              {s.label}
              {s.pattern && " (striped)"}
            </li>
          ))}
        </ul>
      </figure>

      <details className="text-sm">
        <summary className="text-brand-700 cursor-pointer font-medium">Show daily numbers</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Daily dose log for the last {data.days} days</caption>
            <thead className="bg-slate-50 text-left text-xs text-slate-600 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Date
                </th>
                <th scope="col" className="px-3 py-2">
                  Scheduled
                </th>
                <th scope="col" className="px-3 py-2">
                  Taken
                </th>
                <th scope="col" className="px-3 py-2">
                  Skipped
                </th>
                <th scope="col" className="px-3 py-2">
                  Missed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data.history].reverse().map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-slate-700">
                    {formatDate(day.date)}
                  </th>
                  <td className="px-3 py-1.5 tabular-nums">{day.scheduled}</td>
                  <td className="px-3 py-1.5 tabular-nums">{day.taken}</td>
                  <td className="px-3 py-1.5 tabular-nums">{day.skipped}</td>
                  <td className="px-3 py-1.5 tabular-nums">{day.missed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}

function DayBar({ day, max }: { day: Day; max: number }) {
  const weekday = parseDate(day.date).toLocaleDateString(undefined, { weekday: "short" });
  const title = `${weekday} ${formatDate(day.date)}: ${day.taken} taken, ${day.skipped} skipped, ${day.missed} missed of ${day.scheduled} scheduled`;
  return (
    <div
      className="group flex h-full min-w-0 flex-1 flex-col justify-end hover:bg-slate-100"
      title={title}
    >
      {/* Stack bottom-up: taken, skipped, missed — with a 1px surface gap between segments. */}
      <div className="flex flex-col-reverse gap-px">
        {SERIES.map((s) => {
          const value = day[s.key];
          if (!value) return null;
          return (
            <div
              key={s.key}
              className="w-full first:rounded-b-none last:rounded-t-[3px]"
              style={{
                height: `${(value / max) * 120}px`,
                backgroundColor: s.color,
                backgroundImage: s.pattern,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
