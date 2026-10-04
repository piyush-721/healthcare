"use client";

import { Check, CalendarCheck, SkipForward } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, Card, CardHeader, EmptyState, QueryState } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatTime } from "@/lib/format";
import { useLogDoseMutation, useTodayDosesQuery } from "@/services/medications";
import type { TodayDose } from "@/types/api";

import { DoseStatusBadge } from "./DoseStatusBadge";

const doseKey = (dose: TodayDose) => `${dose.schedule_id}:${dose.scheduled_for}`;

/** Today's scheduled doses with one-tap logging. */
export function TodayDoses() {
  const { profileId, can } = useActiveProfile();
  const canLog = can("MANAGE_MEDICATIONS");
  const toast = useToast();
  const query = useTodayDosesQuery({ profile: profileId });
  const [logDose] = useLogDoseMutation();
  const [busy, setBusy] = useState<string | null>(null);

  const log = async (dose: TodayDose, status: "TAKEN" | "SKIPPED") => {
    setBusy(`${doseKey(dose)}:${status}`);
    try {
      await logDose({
        id: dose.medication_id,
        schedule: dose.schedule_id,
        scheduled_for: dose.scheduled_for,
        status,
        note: "",
      }).unwrap();
      toast.success(
        `${dose.medication_name} marked as ${status === "TAKEN" ? "taken" : "skipped"}.`,
      );
    } catch (err) {
      toast.error(err, "The dose could not be logged.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Today"
        description={query.data ? formatDate(query.data.date) : "Scheduled doses for today"}
      />
      <QueryState
        query={query}
        isEmpty={(data) => data.doses.length === 0}
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="No doses scheduled today"
            description="Doses for active medications with set times will appear here."
          />
        }
      >
        {(data) => (
          <ul className="divide-y divide-slate-100" aria-label="Today's doses">
            {data.doses.map((dose) => {
              const key = doseKey(dose);
              const open = dose.status === "PENDING" || dose.status === "OVERDUE";
              return (
                <li
                  key={key}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="w-20 shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                    {formatTime(dose.scheduled_for)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/medications/${dose.medication_id}`}
                      className="hover:text-brand-800 font-medium text-slate-900 hover:underline"
                    >
                      {dose.medication_name}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {dose.dosage}
                      {dose.instructions && <> · {dose.instructions}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DoseStatusBadge status={dose.status} />
                    {canLog && open && (
                      <>
                        <Button
                          size="sm"
                          icon={<Check className="size-4" aria-hidden />}
                          loading={busy === `${key}:TAKEN`}
                          disabled={busy !== null}
                          onClick={() => log(dose, "TAKEN")}
                          aria-label={`Mark ${dose.medication_name} at ${formatTime(dose.scheduled_for)} as taken`}
                        >
                          Taken
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<SkipForward className="size-4" aria-hidden />}
                          loading={busy === `${key}:SKIPPED`}
                          disabled={busy !== null}
                          onClick={() => log(dose, "SKIPPED")}
                          aria-label={`Skip ${dose.medication_name} at ${formatTime(dose.scheduled_for)}`}
                        >
                          Skip
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </Card>
  );
}
