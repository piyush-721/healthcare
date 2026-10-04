"use client";

import { useState, type FormEvent } from "react";

import { ProviderSelect } from "@/components/domain/ProviderSelect";
import {
  Button,
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
  toOptions,
} from "@/components/ui";
import { splitFormErrors } from "@/features/records/formErrors";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { isoToLocalInput, localInputToISO } from "@/lib/format";
import {
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from "@/services/appointments";
import type { Appointment } from "@/types/api";

import { KIND_LABELS, KINDS, REMINDER_OPTIONS, type AppointmentKind } from "./constants";

export type AppointmentFormValues = {
  title: string;
  provider: string | null;
  provider_name: string;
  kind: AppointmentKind;
  scheduled_at: string; // datetime-local value
  duration_minutes: string;
  location: string;
  reason: string;
  follow_up_date: string;
  reminder: string; // "" | minutes
};

const FIELDS = [
  "title",
  "provider",
  "provider_name",
  "kind",
  "scheduled_at",
  "duration_minutes",
  "location",
  "reason",
  "follow_up_date",
  "reminder_minutes_before",
] as const;

function initialValues(appointment?: Appointment): AppointmentFormValues {
  return {
    title: appointment?.title ?? "",
    provider: appointment?.provider ?? null,
    provider_name: appointment?.provider_name ?? "",
    kind: appointment?.kind ?? "IN_PERSON",
    scheduled_at: isoToLocalInput(appointment?.scheduled_at),
    duration_minutes: String(appointment?.duration_minutes ?? 30),
    location: appointment?.location ?? "",
    reason: appointment?.reason ?? "",
    follow_up_date: appointment?.follow_up_date ?? "",
    reminder: appointment
      ? appointment.reminder_minutes_before === null ||
        appointment.reminder_minutes_before === undefined
        ? ""
        : String(appointment.reminder_minutes_before)
      : "1440",
  };
}

export function validateAppointment(values: AppointmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = "Enter a title, e.g. Cardiology follow-up.";
  if (!values.scheduled_at) errors.scheduled_at = "Choose the date and time.";
  const duration = Number(values.duration_minutes);
  if (values.duration_minutes && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
    errors.duration_minutes = "Enter a duration between 1 and 1440 minutes.";
  }
  if (
    values.follow_up_date &&
    values.scheduled_at &&
    values.follow_up_date < values.scheduled_at.slice(0, 10)
  ) {
    errors.follow_up_date = "Follow-up date must be on or after the appointment.";
  }
  return errors;
}

export function AppointmentFormDialog({
  open,
  onClose,
  appointment,
}: {
  open: boolean;
  onClose: () => void;
  appointment?: Appointment;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={appointment ? "Edit appointment" : "New appointment"}
      size="lg"
    >
      {open && <AppointmentForm appointment={appointment} onClose={onClose} />}
    </Dialog>
  );
}

function AppointmentForm({
  appointment,
  onClose,
}: {
  appointment?: Appointment;
  onClose: () => void;
}) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [values, setValues] = useState<AppointmentFormValues>(() => initialValues(appointment));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [create, createState] = useCreateAppointmentMutation();
  const [update, updateState] = useUpdateAppointmentMutation();
  const saving = createState.isLoading || updateState.isLoading;

  const set = <K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const local = validateAppointment(values);
    setErrors(local);
    if (Object.keys(local).length) return;
    const body = {
      title: values.title.trim(),
      provider: values.provider,
      provider_name: values.provider ? "" : values.provider_name.trim(),
      kind: values.kind,
      scheduled_at: localInputToISO(values.scheduled_at),
      duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : 30,
      location: values.location.trim(),
      reason: values.reason.trim(),
      follow_up_date: values.follow_up_date || null,
      reminder_minutes_before: values.reminder ? Number(values.reminder) : null,
    };
    try {
      if (appointment) await update({ id: appointment.id, ...body }).unwrap();
      else await create({ ...body, profile: profileId }).unwrap();
      toast.success(appointment ? "Appointment updated." : "Appointment added.");
      onClose();
    } catch (err) {
      const { fields, needsToast } = splitFormErrors(err, FIELDS);
      if (fields.reminder_minutes_before) fields.reminder = fields.reminder_minutes_before;
      setErrors(fields);
      if (needsToast) toast.error(err);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Title" required error={errors.title}>
        <Input
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Cardiology follow-up"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date and time" required error={errors.scheduled_at}>
          <Input
            type="datetime-local"
            value={values.scheduled_at}
            onChange={(e) => set("scheduled_at", e.target.value)}
          />
        </Field>
        <Field label="Duration (minutes)" error={errors.duration_minutes}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={values.duration_minutes}
            onChange={(e) => set("duration_minutes", e.target.value)}
          />
        </Field>
        <Field label="Type of visit" error={errors.kind}>
          <Select
            value={values.kind}
            onChange={(e) => set("kind", e.target.value as AppointmentKind)}
            options={toOptions(KINDS, KIND_LABELS)}
          />
        </Field>
        <Field label="Reminder" error={errors.reminder}>
          <Select
            value={values.reminder}
            onChange={(e) => set("reminder", e.target.value)}
            options={REMINDER_OPTIONS}
          />
        </Field>
      </div>
      <ProviderSelect
        value={values.provider}
        onChange={(id) => set("provider", id)}
        error={errors.provider}
      />
      {!values.provider && (
        <Field
          label="Or type a provider name"
          error={errors.provider_name}
          hint="Use this if the doctor or clinic isn't saved."
        >
          <Input
            value={values.provider_name}
            onChange={(e) => set("provider_name", e.target.value)}
            placeholder="Dr. Rao"
          />
        </Field>
      )}
      <Field
        label={values.kind === "IN_PERSON" ? "Location" : "Location or link"}
        error={errors.location}
      >
        <Input
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Clinic address or video link"
        />
      </Field>
      <Field label="Reason for visit" error={errors.reason}>
        <Textarea value={values.reason} onChange={(e) => set("reason", e.target.value)} rows={2} />
      </Field>
      <Field label="Follow-up date" error={errors.follow_up_date} hint="Optional">
        <Input
          type="date"
          value={values.follow_up_date}
          min={values.scheduled_at ? values.scheduled_at.slice(0, 10) : undefined}
          onChange={(e) => set("follow_up_date", e.target.value)}
        />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {appointment ? "Save changes" : "Add appointment"}
        </Button>
      </FormActions>
    </form>
  );
}
