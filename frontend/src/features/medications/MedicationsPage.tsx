"use client";

import { Pill, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatDate, formatTime, humanize } from "@/lib/format";
import { useMedicationsQuery } from "@/services/medications";
import type { Medication } from "@/types/api";

import {
  describeDays,
  FREQUENCY_LABELS,
  MEDICATION_DISCLAIMER,
  MEDICATION_STATUS,
} from "./constants";
import { MedicationFormDialog } from "./MedicationFormDialog";
import { TodayDoses } from "./TodayDoses";

const GROUPS: { title: string; statuses: Medication["status"][] }[] = [
  { title: "Active", statuses: ["ACTIVE"] },
  { title: "Paused", statuses: ["PAUSED"] },
  { title: "Completed & stopped", statuses: ["COMPLETED", "STOPPED"] },
];

export function MedicationsPage() {
  const { profileId, can } = useActiveProfile();
  const canManage = can("MANAGE_MEDICATIONS");
  const [addOpen, setAddOpen] = useState(false);
  const query = useMedicationsQuery({ profile: profileId, page_size: 100, ordering: "name" });

  const addButton = canManage && (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAddOpen(true)}>
      Add medication
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medications"
        description="Your medications, schedules and dose history — recorded as prescribed."
        actions={addButton}
      />
      <TodayDoses />
      <QueryState
        query={query}
        isEmpty={(data) => data.results.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={Pill}
              title="No medications yet"
              description="Add a medication with its prescribed dosage and times to get dose reminders and a history of each dose."
              action={addButton}
            />
          </Card>
        }
      >
        {(data) => (
          <div className="space-y-6">
            {GROUPS.map((group) => {
              const items = data.results.filter((m) => group.statuses.includes(m.status));
              if (items.length === 0) return null;
              return (
                <section key={group.title} aria-labelledby={`group-${group.statuses[0]}`}>
                  <h2
                    id={`group-${group.statuses[0]}`}
                    className="mb-3 text-sm font-semibold tracking-wide text-slate-600 uppercase"
                  >
                    {group.title}{" "}
                    <span className="font-normal text-slate-500">({items.length})</span>
                  </h2>
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((medication) => (
                      <li key={medication.id}>
                        <MedicationCard medication={medication} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </QueryState>
      <MedicalDisclaimer>{MEDICATION_DISCLAIMER}</MedicalDisclaimer>
      <MedicationFormDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function MedicationCard({ medication }: { medication: Medication }) {
  const status = MEDICATION_STATUS[medication.status];
  const schedules = [...(medication.schedules ?? [])].sort((a, b) =>
    a.time_of_day.localeCompare(b.time_of_day),
  );
  const frequency = medication.frequency ?? "ONCE_DAILY";
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader
        as="h3"
        title={
          <Link
            href={`/medications/${medication.id}`}
            className="hover:text-brand-800 after:absolute after:inset-0"
          >
            {medication.name}
          </Link>
        }
        description={[medication.dosage, humanize(medication.form ?? "OTHER")].join(" · ")}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <dl className="space-y-1.5 px-4 py-3 text-sm sm:px-5">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-500">Frequency</dt>
          <dd className="text-slate-800">{FREQUENCY_LABELS[frequency]}</dd>
        </div>
        {schedules.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Times</dt>
            <dd className="text-slate-800">
              {schedules.map((s) => formatTime(s.time_of_day)).join(", ")}
              <span className="block text-xs text-slate-500">
                {describeDays(schedules[0]?.days_of_week)}
              </span>
            </dd>
          </div>
        )}
        {medication.prescribed_by_detail?.name && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Prescribed by</dt>
            <dd className="text-slate-800">{medication.prescribed_by_detail.name}</dd>
          </div>
        )}
        {medication.end_date && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Until</dt>
            <dd className="text-slate-800">{formatDate(medication.end_date)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
