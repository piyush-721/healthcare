"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

import { localDayKey } from "./constants";

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Monday-first weeks for the month containing `month`. */
function monthGrid(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1)
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Compact month view. Days with appointments are buttons (with a count for
 * screen readers); selecting one filters the list to that day.
 */
export function MiniCalendar({
  counts,
  selected,
  onSelect,
}: {
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (dayKey: string | null) => void;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const todayKey = localDayKey(new Date());
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900" aria-live="polite">
          {monthLabel}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <table className="w-full table-fixed text-center text-sm">
        <caption className="sr-only">{monthLabel}. Days with appointments can be selected.</caption>
        <thead>
          <tr>
            {WEEKDAY_HEADERS.map((d, i) => (
              <th key={d} scope="col" className="pb-1 text-xs font-medium text-slate-500">
                <abbr title={WEEKDAY_NAMES[i]} className="no-underline">
                  {d}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (!day) return <td key={di} />;
                const key = localDayKey(day);
                const count = counts.get(key) ?? 0;
                const isToday = key === todayKey;
                const isSelected = key === selected;
                const base = cn(
                  "mx-auto flex size-8 flex-col items-center justify-center rounded-full text-sm tabular-nums",
                  isToday && "ring-1 ring-brand-600",
                );
                return (
                  <td key={di} className="py-0.5">
                    {count > 0 ? (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${count} ${count === 1 ? "appointment" : "appointments"}`}
                        onClick={() => onSelect(isSelected ? null : key)}
                        className={cn(
                          base,
                          "font-semibold",
                          isSelected
                            ? "bg-brand-700 text-white"
                            : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                        )}
                      >
                        {day.getDate()}
                        <span
                          aria-hidden
                          className={cn(
                            "-mt-0.5 size-1 rounded-full",
                            isSelected ? "bg-white" : "bg-brand-700",
                          )}
                        />
                      </button>
                    ) : (
                      <span className={cn(base, "text-slate-600")}>{day.getDate()}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
