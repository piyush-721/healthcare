"use client";

import { useState, type FormEvent } from "react";

import { ProviderSelect } from "@/components/domain/ProviderSelect";
import {
  Badge,
  Button,
  Field,
  FormActions,
  Input,
  Textarea,
  type BadgeTone,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { todayISO } from "@/lib/format";
import {
  useCreateTreatmentPlanMutation,
  useUpdateTreatmentPlanMutation,
} from "@/services/treatments";
import type { TreatmentPlan, TreatmentTask } from "@/types/api";

export type PlanStatus = NonNullable<TreatmentPlan["status"]>;
export type TaskKind = NonNullable<TreatmentTask["kind"]>;
export type TaskStatus = NonNullable<TreatmentTask["status"]>;

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
const PLAN_STATUS_TONES: Record<PlanStatus, BadgeTone> = {
  ACTIVE: "brand",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  TASK: "Task",
  TEST: "Test",
  FOLLOW_UP: "Follow-up",
  UPLOAD: "Upload",
};

export function PlanStatusBadge({ status }: { status: PlanStatus | undefined }) {
  const s = status ?? "ACTIVE";
  return <Badge tone={PLAN_STATUS_TONES[s]}>{PLAN_STATUS_LABELS[s]}</Badge>;
}

/** Narrow the untyped `progress` dict; fall back to counting tasks. */
export function readProgress(plan: TreatmentPlan): {
  done: number;
  total: number;
  percent: number;
} {
  const raw = plan.progress as Record<string, unknown> | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const relevant = (plan.tasks ?? []).filter((t) => t.status !== "SKIPPED");
  const done = num(raw?.done) ?? relevant.filter((t) => t.status === "DONE").length;
  const total = num(raw?.total) ?? relevant.length;
  const percent = num(raw?.percent) ?? (total ? Math.round((done / total) * 100) : 0);
  return { done, total, percent };
}

export function PlanProgress({ plan, label }: { plan: TreatmentPlan; label?: string }) {
  const { done, total, percent } = readProgress(plan);
  const text = total ? `${done} of ${total} done` : "No tasks yet";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{text}</span>
        {total > 0 && <span className="tabular-nums">{percent}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label ?? `Progress for ${plan.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="bg-brand-700 h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

type PlanValues = {
  title: string;
  description: string;
  provider: string | null;
  start_date: string;
  next_review_date: string;
};

export function TreatmentPlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: TreatmentPlan;
  onSaved: (plan: TreatmentPlan) => void;
  onCancel: () => void;
}) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [values, setValues] = useState<PlanValues>(() => ({
    title: plan?.title ?? "",
    description: plan?.description ?? "",
    provider: plan?.provider ?? null,
    start_date: plan?.start_date ?? todayISO(),
    next_review_date: plan?.next_review_date ?? "",
  }));
  const [clientErrors, setClientErrors] = useState<Partial<Record<keyof PlanValues, string>>>({});
  const [serverError, setServerError] = useState<unknown>(null);
  const [create, createState] = useCreateTreatmentPlanMutation();
  const [update, updateState] = useUpdateTreatmentPlanMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const errors = { ...getFieldErrors(serverError), ...clientErrors };
  const set = <K extends keyof PlanValues>(key: K, value: PlanValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (event.target !== event.currentTarget) return; // nested provider dialog form
    const next: typeof clientErrors = {};
    if (!values.title.trim()) next.title = "Enter a title for this plan.";
    if (!values.start_date) next.start_date = "Enter the start date.";
    if (
      values.next_review_date &&
      values.start_date &&
      values.next_review_date < values.start_date
    ) {
      next.next_review_date = "Review date can't be before the start date.";
    }
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const body = {
      title: values.title.trim(),
      description: values.description,
      provider: values.provider,
      start_date: values.start_date,
      next_review_date: values.next_review_date || null,
    };
    setServerError(null);
    try {
      const saved = plan
        ? await update({ id: plan.id, ...body }).unwrap()
        : await create({ ...body, profile: profileId }).unwrap();
      toast.success(plan ? "Treatment plan updated." : "Treatment plan created.");
      onSaved(saved);
    } catch (err) {
      setServerError(err);
      if (!Object.keys(getFieldErrors(err)).length) toast.error(err);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Title" required error={errors.title}>
        <Input
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Post-surgery recovery plan"
        />
      </Field>
      <Field
        label="Description"
        error={errors.description}
        hint="Summarize your provider's instructions in your own words."
      >
        <Textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
        />
      </Field>
      <ProviderSelect
        label="Provider"
        value={values.provider}
        onChange={(id) => set("provider", id)}
        error={errors.provider}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" required error={errors.start_date}>
          <Input
            type="date"
            value={values.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </Field>
        <Field label="Next review date" error={errors.next_review_date}>
          <Input
            type="date"
            value={values.next_review_date}
            min={values.start_date || undefined}
            onChange={(e) => set("next_review_date", e.target.value)}
          />
        </Field>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {plan ? "Save changes" : "Create plan"}
        </Button>
      </FormActions>
    </form>
  );
}
