"use client";

import {
  CheckCircle2,
  ClipboardList,
  Pause,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
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
  FormActions,
  Input,
  PageHeader,
  Pagination,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Textarea,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import {
  formatDate,
  formatDateTime,
  formatTime,
  humanize,
  isoToLocalInput,
  localInputToISO,
} from "@/lib/format";
import {
  useDeleteMedicationMutation,
  useLogDoseMutation,
  useMedicationActionMutation,
  useMedicationLogsQuery,
  useMedicationQuery,
  type MedicationAction,
} from "@/services/medications";
import type { Medication } from "@/types/api";

import { AdherenceSection } from "./AdherenceSection";
import {
  describeDays,
  FREQUENCY_LABELS,
  MEDICATION_DISCLAIMER,
  MEDICATION_STATUS,
} from "./constants";
import { DoseStatusBadge } from "./DoseStatusBadge";
import { MedicationFormDialog } from "./MedicationFormDialog";

const BACK = { href: "/medications", label: "Medications" };

export function MedicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useMedicationQuery(id);
  return (
    <QueryState
      query={query}
      loading={
        <>
          <PageHeader title="Medication" back={BACK} />
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500" role="status">
                Loading medication…
              </p>
            </CardBody>
          </Card>
        </>
      }
    >
      {(medication) => <MedicationDetail medication={medication} />}
    </QueryState>
  );
}

const ACTION_COPY: Record<
  MedicationAction,
  { done: string; confirm?: { title: string; message: string; label: string } }
> = {
  pause: { done: "Medication paused. Reminders are on hold." },
  resume: { done: "Medication is active again." },
  complete: {
    done: "Medication marked as completed.",
    confirm: {
      title: "Mark this course as completed?",
      message:
        "Use this when the prescribed course has finished. Reminders stop and the medication moves to Completed. You can reactivate it later.",
      label: "Mark completed",
    },
  },
  stop: {
    done: "Medication marked as stopped.",
    confirm: {
      title: "Record this medication as stopped?",
      message:
        "This records that the medication is no longer being taken, as decided with your prescriber. Reminders stop. You can reactivate it later.",
      label: "Mark stopped",
    },
  },
};

function MedicationDetail({ medication }: { medication: Medication }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useActiveProfile();
  const canManage = can("MANAGE_MEDICATIONS");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<MedicationAction | null>(null);
  const [runAction, actionState] = useMedicationActionMutation();
  const [remove, { isLoading: deleting }] = useDeleteMedicationMutation();
  const status = MEDICATION_STATUS[medication.status];
  const frequency = medication.frequency ?? "ONCE_DAILY";
  const schedules = [...(medication.schedules ?? [])].sort((a, b) =>
    a.time_of_day.localeCompare(b.time_of_day),
  );

  const perform = async (action: MedicationAction) => {
    try {
      await runAction({ id: medication.id, action }).unwrap();
      toast.success(ACTION_COPY[action].done);
      setConfirmAction(null);
    } catch (err) {
      toast.error(err);
    }
  };

  const request = (action: MedicationAction) => {
    if (ACTION_COPY[action].confirm) setConfirmAction(action);
    else void perform(action);
  };

  const onDelete = async () => {
    try {
      await remove(medication.id).unwrap();
      toast.success("Medication deleted.");
      router.push("/medications");
    } catch (err) {
      toast.error(err);
      setDeleteOpen(false);
    }
  };

  const confirmCopy = confirmAction ? ACTION_COPY[confirmAction].confirm : undefined;
  const busy = actionState.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={medication.name}
        back={BACK}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        description={[
          medication.dosage,
          humanize(medication.form ?? "OTHER"),
          FREQUENCY_LABELS[frequency],
        ].join(" · ")}
        actions={
          canManage && (
            <>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                icon={<Trash2 className="size-4" aria-hidden />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            </>
          )
        }
      />

      {canManage && (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-sm text-slate-600 sm:mr-auto">
              {medication.status === "PAUSED" && medication.paused_at
                ? `Paused since ${formatDate(medication.paused_at)}.`
                : medication.status === "ACTIVE"
                  ? "Update the status when your prescriber changes the plan."
                  : `This medication is ${status.label.toLowerCase()}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {frequency === "AS_NEEDED" && medication.status === "ACTIVE" && (
                <Button
                  icon={<Plus className="size-4" aria-hidden />}
                  onClick={() => setLogOpen(true)}
                >
                  Log an as-needed dose
                </Button>
              )}
              {medication.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  icon={<Pause className="size-4" aria-hidden />}
                  loading={busy}
                  onClick={() => request("pause")}
                >
                  Pause
                </Button>
              )}
              {medication.status !== "ACTIVE" && (
                <Button
                  variant="secondary"
                  icon={<Play className="size-4" aria-hidden />}
                  loading={busy}
                  onClick={() => request("resume")}
                >
                  {medication.status === "PAUSED" ? "Resume" : "Reactivate"}
                </Button>
              )}
              {(medication.status === "ACTIVE" || medication.status === "PAUSED") && (
                <>
                  <Button
                    variant="secondary"
                    icon={<CheckCircle2 className="size-4" aria-hidden />}
                    onClick={() => request("complete")}
                  >
                    Mark completed
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Square className="size-4" aria-hidden />}
                    onClick={() => request("stop")}
                  >
                    Mark stopped
                  </Button>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <CardBody className="py-1">
            <DetailList
              items={[
                { label: "Dosage", value: medication.dosage },
                { label: "Form", value: humanize(medication.form ?? "OTHER") },
                { label: "Instructions", value: medication.instructions },
                { label: "Start date", value: formatDate(medication.start_date) },
                {
                  label: "End date",
                  value: medication.end_date ? formatDate(medication.end_date) : null,
                },
                { label: "Prescribed by", value: medication.prescribed_by_detail?.name },
                { label: "Reminders", value: medication.reminders_enabled ? "On" : "Off" },
                {
                  label: "Notes",
                  value: medication.notes ? (
                    <span className="whitespace-pre-line">{medication.notes}</span>
                  ) : null,
                },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Schedule" description={FREQUENCY_LABELS[frequency]} />
          <CardBody>
            {schedules.length === 0 ? (
              <p className="text-sm text-slate-600">
                {frequency === "AS_NEEDED"
                  ? "Taken as needed — no fixed times. Each logged dose appears in the history below."
                  : "No times set."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {schedules.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-slate-900 tabular-nums">
                      {formatTime(s.time_of_day)}
                    </span>
                    <span className="text-slate-600">{describeDays(s.days_of_week)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {frequency !== "AS_NEEDED" && <AdherenceSection medicationId={medication.id} />}
      <DoseLogHistory medicationId={medication.id} />
      <MedicalDisclaimer>{MEDICATION_DISCLAIMER}</MedicalDisclaimer>

      <MedicationFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        medication={medication}
      />
      <LogAsNeededDialog open={logOpen} onClose={() => setLogOpen(false)} medication={medication} />
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && perform(confirmAction)}
        loading={busy}
        tone="primary"
        title={confirmCopy?.title ?? ""}
        confirmLabel={confirmCopy?.label}
        message={confirmCopy?.message}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this medication?"
        confirmLabel="Delete medication"
        message={
          <>
            <strong className="font-medium text-slate-900">{medication.name}</strong> and its entire
            dose history will be permanently deleted. To keep the history, mark it completed or
            stopped instead.
          </>
        }
      />
    </div>
  );
}

function LogAsNeededDialog({
  open,
  onClose,
  medication,
}: {
  open: boolean;
  onClose: () => void;
  medication: Medication;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log an as-needed dose"
      description={`${medication.name} · ${medication.dosage}`}
      size="sm"
    >
      {open && <LogAsNeededForm medication={medication} onClose={onClose} />}
    </Dialog>
  );
}

function LogAsNeededForm({ medication, onClose }: { medication: Medication; onClose: () => void }) {
  const toast = useToast();
  const [takenAt, setTakenAt] = useState(() => isoToLocalInput(new Date().toISOString()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [logDose, { isLoading }] = useLogDoseMutation();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!takenAt) {
      setError("Enter when the dose was taken.");
      return;
    }
    if (new Date(takenAt).getTime() > Date.now() + 60_000) {
      setError("The time can't be in the future.");
      return;
    }
    setError(undefined);
    try {
      await logDose({
        id: medication.id,
        schedule: null,
        scheduled_for: null,
        status: "TAKEN",
        taken_at: localInputToISO(takenAt),
        note: note.trim(),
      }).unwrap();
      toast.success("Dose logged.");
      onClose();
    } catch (err) {
      toast.error(err, "The dose could not be logged.");
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Taken at" required error={error}>
        <Input type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
      </Field>
      <Field label="Note" hint="Optional">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Log dose
        </Button>
      </FormActions>
    </form>
  );
}

function DoseLogHistory({ medicationId }: { medicationId: string }) {
  const [page, setPage] = useState(1);
  const query = useMedicationLogsQuery({ id: medicationId, page });
  return (
    <Card>
      <CardHeader title="Dose log" description="Every dose recorded for this medication." />
      <QueryState
        query={query}
        isEmpty={(data) => data.results.length === 0}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No doses logged yet"
            description="Doses marked as taken or skipped appear here."
          />
        }
      >
        {(data) => (
          <>
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data.results.map((log) => (
                <li key={log.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {formatDateTime(log.scheduled_for ?? log.taken_at ?? log.created_at)}
                    </span>
                    <DoseStatusBadge status={log.status} />
                  </div>
                  <p className="text-slate-500">
                    {log.taken_at && <>Taken {formatDateTime(log.taken_at)} · </>}
                    Logged by {log.logged_by_name || "—"}
                  </p>
                  {log.note && <p className="text-slate-600">{log.note}</p>}
                </li>
              ))}
            </ul>
            <div className="max-sm:hidden">
              <Table caption="Dose log">
                <THead>
                  <tr>
                    <Th>Scheduled for</Th>
                    <Th>Status</Th>
                    <Th>Taken at</Th>
                    <Th>Logged by</Th>
                    <Th>Note</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.results.map((log) => (
                    <Tr key={log.id}>
                      <Td>{log.scheduled_for ? formatDateTime(log.scheduled_for) : "As needed"}</Td>
                      <Td>
                        <DoseStatusBadge status={log.status} />
                      </Td>
                      <Td>{log.taken_at ? formatDateTime(log.taken_at) : "—"}</Td>
                      <Td>{log.logged_by_name || "—"}</Td>
                      <Td className="max-w-xs">{log.note || "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}
