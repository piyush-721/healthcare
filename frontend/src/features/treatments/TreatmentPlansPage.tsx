"use client";

import { CalendarClock, ClipboardList, Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
  Tabs,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatDate, todayISO } from "@/lib/format";
import { useTreatmentPlansQuery } from "@/services/treatments";
import type { TreatmentPlan } from "@/types/api";

import {
  PLAN_STATUS_LABELS,
  PlanProgress,
  PlanStatusBadge,
  TreatmentPlanForm,
  type PlanStatus,
} from "./shared";

const STATUSES: PlanStatus[] = ["ACTIVE", "COMPLETED", "ARCHIVED"];

const EMPTY_COPY: Record<PlanStatus, string> = {
  ACTIVE:
    "Create a plan to turn your provider's instructions into a simple checklist you can track.",
  COMPLETED: "Plans you mark as completed will appear here.",
  ARCHIVED: "Plans you archive will appear here.",
};

function PlanCard({ plan }: { plan: TreatmentPlan }) {
  const review = plan.next_review_date;
  const reviewPast = review && review < todayISO() && plan.status === "ACTIVE";
  return (
    <Card className="flex flex-col">
      <Link
        href={`/treatments/${plan.id}`}
        className="flex flex-1 flex-col gap-3 rounded-[var(--radius-card)] p-4 hover:bg-slate-50/70 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-slate-900">{plan.title}</h2>
          <PlanStatusBadge status={plan.status} />
        </div>
        {plan.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{plan.description}</p>
        )}
        <PlanProgress plan={plan} />
        <dl className="mt-auto grid gap-1 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1">
              <CalendarClock className="size-4 text-slate-400" aria-hidden />
              <span className="sr-only">Next review</span>
            </dt>
            <dd>
              {review ? (
                <>
                  Review {formatDate(review)}
                  {reviewPast && (
                    <span className="ml-1 font-medium text-amber-800">(date passed)</span>
                  )}
                </>
              ) : (
                "No review date"
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <Stethoscope className="size-4 text-slate-400" aria-hidden />
              <span className="sr-only">Provider</span>
            </dt>
            <dd>{plan.provider_detail?.name ?? "No provider"}</dd>
          </div>
        </dl>
      </Link>
    </Card>
  );
}

function PlansList({
  profileId,
  status,
  onAdd,
}: {
  profileId: string | undefined;
  status: PlanStatus;
  onAdd?: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useTreatmentPlansQuery({ profile: profileId, status, page });
  return (
    <QueryState
      query={query}
      isEmpty={(d) => d.results.length === 0}
      empty={
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={`No ${PLAN_STATUS_LABELS[status].toLowerCase()} plans`}
            description={EMPTY_COPY[status]}
            action={
              status === "ACTIVE" && onAdd ? (
                <Button onClick={onAdd} icon={<Plus className="size-4" aria-hidden />}>
                  New treatment plan
                </Button>
              ) : undefined
            }
          />
        </Card>
      }
    >
      {(data) => (
        <div className="space-y-4">
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.results.map((plan) => (
              <li key={plan.id} className="flex">
                <div className="w-full">
                  <PlanCard plan={plan} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onChange={setPage} />
        </div>
      )}
    </QueryState>
  );
}

function TreatmentPlansContent({
  profileId,
  canManage,
}: {
  profileId: string | undefined;
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PlanStatus>("ACTIVE");
  const [adding, setAdding] = useState(false);
  const onAdd = canManage ? () => setAdding(true) : undefined;

  return (
    <>
      <PageHeader
        title="Treatment plans"
        description="Organizational checklists built from your provider's instructions — follow-ups, tests and tasks in one place. HealthOS doesn't recommend treatment."
        actions={
          onAdd && (
            <Button onClick={onAdd} icon={<Plus className="size-4" aria-hidden />}>
              New treatment plan
            </Button>
          )
        }
      />
      <Tabs
        label="Plan status"
        value={status}
        onChange={(id) => setStatus(id as PlanStatus)}
        items={STATUSES.map((s) => ({ id: s, label: PLAN_STATUS_LABELS[s] }))}
      >
        <PlansList key={status} profileId={profileId} status={status} onAdd={onAdd} />
      </Tabs>
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="New treatment plan"
        description="Write down the steps your provider asked you to follow so you can keep track of them. This is a checklist for organizing, not medical advice."
      >
        <TreatmentPlanForm
          onCancel={() => setAdding(false)}
          onSaved={(plan) => {
            setAdding(false);
            router.push(`/treatments/${plan.id}`);
          }}
        />
      </Dialog>
    </>
  );
}

export function TreatmentPlansPage() {
  const { profileId, can } = useActiveProfile();
  return (
    <TreatmentPlansContent
      key={profileId ?? "self"}
      profileId={profileId}
      canManage={can("MANAGE_TREATMENT_PLANS")}
    />
  );
}
