"use client";

import {
  Ban,
  CheckCircle2,
  CircleSlash,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  Dialog,
  Field,
  FormActions,
  PageHeader,
  QueryState,
  Textarea,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  useAddAppointmentNoteMutation,
  useAppointmentQuery,
  useChangeAppointmentStatusMutation,
  useDeleteAppointmentMutation,
  useDeleteAppointmentNoteMutation,
} from "@/services/appointments";
import type { Appointment, AppointmentNote } from "@/types/api";

import { AppointmentFormDialog } from "./AppointmentFormDialog";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { KIND_LABELS, providerLabel, reminderLabel } from "./constants";

const BACK = { href: "/appointments", label: "Appointments" };

type StatusTarget = "COMPLETED" | "MISSED" | "SCHEDULED";

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAppointmentQuery(id);
  return (
    <QueryState
      query={query}
      loading={
        <>
          <PageHeader title="Appointment" back={BACK} />
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500" role="status">
                Loading appointment…
              </p>
            </CardBody>
          </Card>
        </>
      }
    >
      {(appointment) => <AppointmentDetail appointment={appointment} />}
    </QueryState>
  );
}

const STATUS_DONE: Record<StatusTarget, string> = {
  COMPLETED: "Marked as completed.",
  MISSED: "Marked as missed.",
  SCHEDULED: "Appointment restored.",
};

function AppointmentDetail({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useActiveProfile();
  const canManage = can("MANAGE_APPOINTMENTS");
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changeStatus, statusState] = useChangeAppointmentStatusMutation();
  const [remove, { isLoading: deleting }] = useDeleteAppointmentMutation();

  // Captured once per mount; the status rules only need minute-level accuracy.
  const [now] = useState(() => Date.now());
  const isPast = appointment.needs_update || new Date(appointment.scheduled_at).getTime() < now;
  const isScheduled = appointment.status === "SCHEDULED";

  const setStatus = async (status: StatusTarget) => {
    try {
      await changeStatus({ id: appointment.id, status }).unwrap();
      toast.success(STATUS_DONE[status]);
    } catch (err) {
      toast.error(err);
    }
  };

  const onDelete = async () => {
    try {
      await remove(appointment.id).unwrap();
      toast.success("Appointment deleted.");
      router.push("/appointments");
    } catch (err) {
      toast.error(err);
      setDeleteOpen(false);
    }
  };

  const provider = appointment.provider_detail
    ? [
        appointment.provider_detail.name,
        appointment.provider_detail.specialty || appointment.provider_detail.organization,
      ]
        .filter(Boolean)
        .join(" · ")
    : appointment.provider_name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={appointment.title}
        back={BACK}
        badge={<AppointmentStatusBadge appointment={appointment} />}
        description={`${formatDateTime(appointment.scheduled_at)} · ${formatRelative(appointment.scheduled_at)}`}
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

      {appointment.needs_update && (
        <Alert tone="warning" title="Did this appointment take place?">
          The appointment time has passed. Record what happened to keep your history accurate.
        </Alert>
      )}

      {canManage && (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-sm text-slate-600 sm:mr-auto">
              {appointment.status === "CANCELLED"
                ? "This appointment was cancelled."
                : isScheduled && !isPast
                  ? "Plans changed? You can cancel this appointment."
                  : "Update what happened at this appointment."}
            </p>
            <div className="flex flex-wrap gap-2">
              {isScheduled && !isPast && (
                <Button
                  variant="secondary"
                  icon={<Ban className="size-4" aria-hidden />}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel appointment
                </Button>
              )}
              {isPast &&
                appointment.status !== "CANCELLED" &&
                appointment.status !== "COMPLETED" && (
                  <Button
                    icon={<CheckCircle2 className="size-4" aria-hidden />}
                    loading={
                      statusState.isLoading && statusState.originalArgs?.status === "COMPLETED"
                    }
                    disabled={statusState.isLoading}
                    onClick={() => setStatus("COMPLETED")}
                  >
                    Mark completed
                  </Button>
                )}
              {isPast && appointment.status !== "CANCELLED" && appointment.status !== "MISSED" && (
                <Button
                  variant="secondary"
                  icon={<CircleSlash className="size-4" aria-hidden />}
                  loading={statusState.isLoading && statusState.originalArgs?.status === "MISSED"}
                  disabled={statusState.isLoading}
                  onClick={() => setStatus("MISSED")}
                >
                  Mark missed
                </Button>
              )}
              {appointment.status === "CANCELLED" && (
                <Button
                  variant="secondary"
                  icon={<RotateCcw className="size-4" aria-hidden />}
                  loading={statusState.isLoading}
                  onClick={() => setStatus("SCHEDULED")}
                >
                  Restore
                </Button>
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
                { label: "Date and time", value: formatDateTime(appointment.scheduled_at) },
                {
                  label: "Duration",
                  value: appointment.duration_minutes
                    ? `${appointment.duration_minutes} minutes`
                    : null,
                },
                { label: "Type", value: KIND_LABELS[appointment.kind ?? "IN_PERSON"] },
                { label: "Provider", value: provider || providerLabel(appointment) },
                {
                  label: "Location",
                  value: appointment.location ? (
                    <span className="break-words">{appointment.location}</span>
                  ) : null,
                },
                {
                  label: "Reason",
                  value: appointment.reason ? (
                    <span className="whitespace-pre-line">{appointment.reason}</span>
                  ) : null,
                },
                {
                  label: "Follow-up date",
                  value: appointment.follow_up_date ? formatDate(appointment.follow_up_date) : null,
                },
                { label: "Reminder", value: reminderLabel(appointment.reminder_minutes_before) },
                ...(appointment.status === "CANCELLED"
                  ? [{ label: "Cancellation reason", value: appointment.cancellation_reason }]
                  : []),
              ]}
            />
          </CardBody>
        </Card>
        <NotesCard appointment={appointment} canManage={canManage} />
      </div>

      <AppointmentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        appointment={appointment}
      />
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        appointment={appointment}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this appointment?"
        confirmLabel="Delete appointment"
        message={
          <>
            <strong className="font-medium text-slate-900">{appointment.title}</strong> and its
            notes will be permanently deleted. To keep a record, cancel it instead.
          </>
        }
      />
    </div>
  );
}

function CancelDialog({
  open,
  onClose,
  appointment,
}: {
  open: boolean;
  onClose: () => void;
  appointment: Appointment;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [changeStatus, { isLoading }] = useChangeAppointmentStatusMutation();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await changeStatus({
        id: appointment.id,
        status: "CANCELLED",
        cancellation_reason: reason.trim(),
      }).unwrap();
      toast.success("Appointment cancelled.");
      setReason("");
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancel this appointment?"
      description={appointment.title}
      size="sm"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Reason" hint="Optional — e.g. rescheduled by the clinic.">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Keep appointment
          </Button>
          <Button type="submit" variant="danger" loading={isLoading}>
            Cancel appointment
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

function NotesCard({ appointment, canManage }: { appointment: Appointment; canManage: boolean }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [toDelete, setToDelete] = useState<AppointmentNote | null>(null);
  const [addNote, { isLoading: adding }] = useAddAppointmentNoteMutation();
  const [deleteNote, { isLoading: deleting }] = useDeleteAppointmentNoteMutation();
  const notes = [...appointment.notes].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write a note first.");
      return;
    }
    setError(undefined);
    try {
      await addNote({ id: appointment.id, body: body.trim() }).unwrap();
      setBody("");
      toast.success("Note added.");
    } catch (err) {
      const fieldError = getFieldErrors(err).body;
      if (fieldError) setError(fieldError);
      else toast.error(err);
    }
  };

  const onDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteNote({ id: appointment.id, noteId: toDelete.id }).unwrap();
      toast.success("Note deleted.");
    } catch (err) {
      toast.error(err);
    } finally {
      setToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Notes"
        description="What was discussed, questions to ask, instructions received."
      />
      <CardBody className="space-y-4">
        {canManage && (
          <form onSubmit={onAdd} className="space-y-2" noValidate>
            <Field label="Add a note" error={error} hideLabel>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Add a note…"
                maxLength={5000}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={adding}>
                Add note
              </Button>
            </div>
          </form>
        )}
        {notes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <MessageSquare className="size-4" aria-hidden />
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm whitespace-pre-line text-slate-800">{note.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {note.author_name || "Someone"} · {formatDateTime(note.created_at)}
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setToDelete(note)}
                      aria-label={`Delete note from ${formatDateTime(note.created_at)}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this note?"
        confirmLabel="Delete note"
        message="The note will be permanently deleted."
      />
    </Card>
  );
}
