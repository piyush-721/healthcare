"use client";

import {
  Archive,
  Check,
  CheckCircle2,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  QueryState,
  Select,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import {
  useAddTreatmentTaskMutation,
  useDeleteTreatmentPlanMutation,
  useDeleteTreatmentTaskMutation,
  useTreatmentPlanQuery,
  useUpdateTreatmentPlanMutation,
  useUpdateTreatmentTaskMutation,
} from "@/services/treatments";
import type { TreatmentPlan, TreatmentTask } from "@/types/api";

import {
  PlanProgress,
  PlanStatusBadge,
  TASK_KIND_LABELS,
  TreatmentPlanForm,
  type PlanStatus,
  type TaskKind,
  type TaskStatus,
} from "./shared";

const KINDS = Object.keys(TASK_KIND_LABELS) as TaskKind[];

export function isOverdue(task: TreatmentTask, today = todayISO()): boolean {
  return (task.status ?? "PENDING") === "PENDING" && !!task.due_date && task.due_date < today;
}

function TaskItem({
  plan,
  task,
  canManage,
  onDelete,
}: {
  plan: TreatmentPlan;
  task: TreatmentTask;
  canManage: boolean;
  onDelete: (task: TreatmentTask) => void;
}) {
  const toast = useToast();
  const [updateTask, { isLoading }] = useUpdateTreatmentTaskMutation();
  const status: TaskStatus = task.status ?? "PENDING";
  const done = status === "DONE";
  const skipped = status === "SKIPPED";
  const overdue = isOverdue(task);
  const checkboxId = `task-${task.id}`;

  const setStatus = async (next: TaskStatus, message: string) => {
    try {
      await updateTask({ planId: plan.id, taskId: task.id, status: next }).unwrap();
      toast.success(message);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <input
        id={checkboxId}
        type="checkbox"
        checked={done}
        disabled={!canManage || isLoading || skipped}
        onChange={(e) =>
          void setStatus(
            e.target.checked ? "DONE" : "PENDING",
            e.target.checked ? "Marked as done." : "Marked as not done.",
          )
        }
        className="accent-brand-700 mt-1 size-4 shrink-0 rounded border-slate-300"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <label
          htmlFor={checkboxId}
          className={cn(
            "block font-medium text-slate-900",
            (done || skipped) && "text-slate-500 line-through",
          )}
        >
          {task.title}
        </label>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <Badge tone="info">{TASK_KIND_LABELS[task.kind ?? "TASK"]}</Badge>
          {done && (
            <Badge tone="success">
              <Check className="size-3" aria-hidden /> Done
            </Badge>
          )}
          {skipped && <Badge tone="neutral">Skipped</Badge>}
          {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
          {overdue && <Badge tone="warning">Overdue</Badge>}
          {done && task.completed_at && (
            <span>
              · Completed {formatDateTime(task.completed_at)}
              {task.completed_by_name ? ` by ${task.completed_by_name}` : ""}
            </span>
          )}
        </div>
        {task.notes && <p className="text-xs text-slate-500">{task.notes}</p>}
      </div>
      {canManage && (
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {status === "PENDING" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => void setStatus("SKIPPED", "Task skipped.")}
              icon={<SkipForward className="size-4" aria-hidden />}
              aria-label={`Skip “${task.title}”`}
            >
              <span className="max-sm:sr-only">Skip</span>
            </Button>
          )}
          {skipped && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => void setStatus("PENDING", "Task restored.")}
              icon={<RotateCcw className="size-4" aria-hidden />}
              aria-label={`Restore “${task.title}”`}
            >
              <span className="max-sm:sr-only">Restore</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(task)}
            icon={<Trash2 className="size-4" aria-hidden />}
            aria-label={`Delete “${task.title}”`}
          />
        </div>
      )}
    </li>
  );
}

function AddTaskForm({ planId }: { planId: string }) {
  const toast = useToast();
  const [addTask, { isLoading, error }] = useAddTreatmentTaskMutation();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("TASK");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const fieldErrors = getFieldErrors(error);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("Enter what needs to be done.");
      return;
    }
    setTitleError(undefined);
    try {
      await addTask({ planId, title: title.trim(), kind, due_date: dueDate || null }).unwrap();
      toast.success("Task added.");
      setTitle("");
      setDueDate("");
      setKind("TASK");
    } catch (err) {
      if (!Object.keys(getFieldErrors(err)).length) toast.error(err);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-12 sm:px-5"
      aria-label="Add a task"
    >
      <Field
        label="New task"
        required
        error={titleError ?? fieldErrors.title}
        className="sm:col-span-5"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Book follow-up blood test"
        />
      </Field>
      <Field label="Type" error={fieldErrors.kind} className="sm:col-span-2">
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as TaskKind)}
          options={KINDS.map((k) => ({ value: k, label: TASK_KIND_LABELS[k] }))}
        />
      </Field>
      <Field label="Due date" error={fieldErrors.due_date} className="sm:col-span-3">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <div className="flex items-end sm:col-span-2">
        <Button
          type="submit"
          loading={isLoading}
          className="w-full"
          icon={<Plus className="size-4" aria-hidden />}
        >
          Add
        </Button>
      </div>
    </form>
  );
}

function PlanView({ plan, canManage }: { plan: TreatmentPlan; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TreatmentTask | null>(null);
  const [updatePlan, { isLoading: updating }] = useUpdateTreatmentPlanMutation();
  const [deletePlan, { isLoading: deleting }] = useDeleteTreatmentPlanMutation();
  const [deleteTask, { isLoading: deletingTask }] = useDeleteTreatmentTaskMutation();
  const status: PlanStatus = plan.status ?? "ACTIVE";
  const tasks = [...(plan.tasks ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const changeStatus = async (next: PlanStatus, message: string) => {
    try {
      await updatePlan({ id: plan.id, status: next }).unwrap();
      toast.success(message);
    } catch (err) {
      toast.error(err);
    }
  };

  const onDeletePlan = async () => {
    try {
      await deletePlan(plan.id).unwrap();
      toast.success("Treatment plan deleted.");
      router.push("/treatments");
    } catch (err) {
      toast.error(err);
      setConfirmDelete(false);
    }
  };

  const onDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask({ planId: plan.id, taskId: taskToDelete.id }).unwrap();
      toast.success("Task deleted.");
    } catch (err) {
      toast.error(err);
    } finally {
      setTaskToDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/treatments", label: "Treatment plans" }}
        title={plan.title}
        badge={<PlanStatusBadge status={status} />}
        description={plan.provider_detail?.name ? `From ${plan.provider_detail.name}` : undefined}
        actions={
          canManage && (
            <>
              {status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  disabled={updating}
                  onClick={() => void changeStatus("COMPLETED", "Plan marked as completed.")}
                  icon={<CheckCircle2 className="size-4" aria-hidden />}
                >
                  Mark completed
                </Button>
              )}
              {status !== "ACTIVE" && (
                <Button
                  variant="secondary"
                  disabled={updating}
                  onClick={() => void changeStatus("ACTIVE", "Plan reactivated.")}
                  icon={<RotateCcw className="size-4" aria-hidden />}
                >
                  Reactivate
                </Button>
              )}
              {status !== "ARCHIVED" && (
                <Button
                  variant="secondary"
                  disabled={updating}
                  onClick={() => void changeStatus("ARCHIVED", "Plan archived.")}
                  icon={<Archive className="size-4" aria-hidden />}
                >
                  Archive
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                icon={<Pencil className="size-4" aria-hidden />}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                icon={<Trash2 className="size-4" aria-hidden />}
              >
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Checklist"
            description="Steps from your provider's instructions. Tick them off as you go."
          />
          <CardBody className="border-b border-slate-100">
            <PlanProgress plan={plan} label="Checklist progress" />
          </CardBody>
          {tasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description={
                canManage
                  ? "Add the first step below — for example a test to book or a follow-up visit."
                  : "No steps have been added to this plan."
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100" aria-label="Tasks">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  plan={plan}
                  task={task}
                  canManage={canManage}
                  onDelete={setTaskToDelete}
                />
              ))}
            </ul>
          )}
          {canManage && <AddTaskForm planId={plan.id} />}
        </Card>

        <Card className="self-start">
          <CardHeader title="About this plan" />
          <CardBody className="py-1">
            <DetailList
              items={[
                { label: "Status", value: <PlanStatusBadge status={status} /> },
                { label: "Started", value: formatDate(plan.start_date) },
                {
                  label: "Next review",
                  value: plan.next_review_date ? (
                    <>
                      {formatDate(plan.next_review_date)}
                      {status === "ACTIVE" && plan.next_review_date < todayISO() && (
                        <span className="ml-1 text-amber-800">(date passed)</span>
                      )}
                    </>
                  ) : null,
                },
                { label: "Provider", value: plan.provider_detail?.name },
                {
                  label: "Description",
                  value: plan.description ? (
                    <span className="whitespace-pre-line">{plan.description}</span>
                  ) : null,
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit treatment plan">
        <TreatmentPlanForm
          plan={plan}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDeletePlan}
        loading={deleting}
        title="Delete this treatment plan?"
        message={
          <>
            “{plan.title}” and all {tasks.length} of its tasks will be permanently deleted. To keep
            it for reference, archive it instead.
          </>
        }
        confirmLabel="Delete plan"
      />
      <ConfirmDialog
        open={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        onConfirm={onDeleteTask}
        loading={deletingTask}
        title="Delete this task?"
        message={<>“{taskToDelete?.title}” will be removed from the checklist.</>}
        confirmLabel="Delete task"
      />
    </>
  );
}

export function TreatmentPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useActiveProfile();
  const query = useTreatmentPlanQuery(id);
  return (
    <QueryState query={query}>
      {(plan) => <PlanView plan={plan} canManage={can("MANAGE_TREATMENT_PLANS")} />}
    </QueryState>
  );
}
