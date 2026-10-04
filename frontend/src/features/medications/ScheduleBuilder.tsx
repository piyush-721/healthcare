"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

import { MAX_SCHEDULE_TIMES, WEEKDAYS } from "./constants";

/** Edit a list of daily times (HH:MM) plus optional weekdays that apply to all of them. */
export function ScheduleBuilder({
  times,
  days,
  onTimesChange,
  onDaysChange,
  error,
}: {
  times: string[];
  days: number[];
  onTimesChange: (times: string[]) => void;
  onDaysChange: (days: number[]) => void;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const counts = new Map<string, number>();
  times.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));

  const setTime = (index: number, value: string) =>
    onTimesChange(times.map((t, i) => (i === index ? value : t)));
  const removeTime = (index: number) => onTimesChange(times.filter((_, i) => i !== index));
  const addTime = () => {
    const last = times[times.length - 1];
    let next = "09:00";
    if (last && /^\d{2}:\d{2}$/.test(last)) {
      const hour = (Number(last.slice(0, 2)) + 4) % 24;
      next = `${String(hour).padStart(2, "0")}:${last.slice(3, 5)}`;
    }
    onTimesChange([...times, times.includes(next) ? "" : next]);
  };
  const toggleDay = (day: number) =>
    onDaysChange(
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b),
    );

  return (
    <fieldset
      className="space-y-4 rounded-lg border border-slate-200 p-4"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="px-1 text-sm font-medium text-slate-800">
        Schedule
        <span className="text-red-600" aria-hidden="true">
          {" "}
          *
        </span>
      </legend>
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Times of day</p>
        {times.length === 0 && <p className="text-sm text-slate-500">No times added yet.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {times.map((time, index) => {
            const duplicate = time !== "" && (counts.get(time) ?? 0) > 1;
            return (
              <li key={index} className="flex items-center gap-2">
                <label htmlFor={`${id}-time-${index}`} className="sr-only">
                  Time {index + 1}
                </label>
                <Input
                  id={`${id}-time-${index}`}
                  type="time"
                  value={time}
                  required
                  aria-invalid={duplicate || undefined}
                  onChange={(e) => setTime(index, e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTime(index)}
                  aria-label={`Remove time ${index + 1}`}
                  className="h-10"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={addTime}
          disabled={times.length >= MAX_SCHEDULE_TIMES}
        >
          Add time
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-slate-600" id={`${id}-days`}>
          Days of the week{" "}
          <span className="text-slate-500">(leave all unselected for every day)</span>
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${id}-days`}>
          {WEEKDAYS.map((day) => {
            const selected = days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={selected}
                aria-label={day.long}
                onClick={() => toggleDay(day.value)}
                className={cn(
                  "h-9 min-w-12 rounded-full border px-3 text-sm font-medium transition-colors",
                  selected
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
