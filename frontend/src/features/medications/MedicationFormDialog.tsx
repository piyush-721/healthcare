"use client";

import { useState, type FormEvent } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import { ProviderSelect } from "@/components/domain/ProviderSelect";
import {
  Button,
  Checkbox,
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
  toOptions,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { splitFormErrors } from "@/features/records/formErrors";
import { useCreateMedicationMutation, useUpdateMedicationMutation } from "@/services/medications";
import type { Medication } from "@/types/api";

import {
  FORMS,
  FREQUENCIES,
  FREQUENCY_LABELS,
  MEDICATION_DISCLAIMER,
  type Frequency,
  type MedicationForm as FormKind,
} from "./constants";
import {
  buildMedicationPayload,
  initialMedicationValues,
  timesForFrequency,
  validateMedication,
  type MedicationFormValues,
} from "./schedule";
import { ScheduleBuilder } from "./ScheduleBuilder";

const FIELDS = [
  "name",
  "dosage",
  "form",
  "frequency",
  "schedules",
  "start_date",
  "end_date",
  "instructions",
  "reminders_enabled",
  "prescribed_by",
  "notes",
] as const;

export function MedicationFormDialog({
  open,
  onClose,
  medication,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  medication?: Medication;
  onSaved?: (medication: Medication) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={medication ? "Edit medication" : "Add medication"}
      size="lg"
    >
      {open && <MedicationForm medication={medication} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

export function MedicationForm({
  medication,
  onClose,
  onSaved,
}: {
  medication?: Medication;
  onClose: () => void;
  onSaved?: (medication: Medication) => void;
}) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [values, setValues] = useState<MedicationFormValues>(() =>
    initialMedicationValues(medication),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [create, createState] = useCreateMedicationMutation();
  const [update, updateState] = useUpdateMedicationMutation();
  const saving = createState.isLoading || updateState.isLoading;

  const set = <K extends keyof MedicationFormValues>(key: K, value: MedicationFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onFrequencyChange = (frequency: Frequency) =>
    setValues((v) => ({ ...v, frequency, times: timesForFrequency(frequency, v.times) }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const local = validateMedication(values);
    setErrors(local);
    if (Object.keys(local).length) return;
    const body = buildMedicationPayload(values);
    try {
      const saved = medication
        ? await update({ id: medication.id, ...body }).unwrap()
        : await create({ ...body, profile: profileId }).unwrap();
      toast.success(medication ? "Medication updated." : `${saved.name} added.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const { fields, needsToast } = splitFormErrors(err, FIELDS);
      setErrors(fields);
      if (needsToast) toast.error(err);
    }
  };

  const asNeeded = values.frequency === "AS_NEEDED";

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Medication name" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Metformin"
          />
        </Field>
        <Field label="Dosage" required error={errors.dosage} hint="As prescribed, e.g. 500 mg">
          <Input
            value={values.dosage}
            onChange={(e) => set("dosage", e.target.value)}
            placeholder="500 mg"
          />
        </Field>
        <Field label="Form" error={errors.form}>
          <Select
            value={values.form}
            onChange={(e) => set("form", e.target.value as FormKind)}
            options={toOptions(FORMS)}
          />
        </Field>
        <Field label="Frequency" required error={errors.frequency}>
          <Select
            value={values.frequency}
            onChange={(e) => onFrequencyChange(e.target.value as Frequency)}
            options={toOptions(FREQUENCIES, FREQUENCY_LABELS)}
          />
        </Field>
      </div>
      {asNeeded ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          As-needed medications have no fixed times. You can log each dose from the
          medication&apos;s page.
        </p>
      ) : (
        <ScheduleBuilder
          times={values.times}
          days={values.days}
          onTimesChange={(times) => set("times", times)}
          onDaysChange={(days) => set("days", days)}
          error={errors.schedules}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" required error={errors.start_date}>
          <Input
            type="date"
            value={values.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </Field>
        <Field label="End date" error={errors.end_date} hint="Optional">
          <Input
            type="date"
            value={values.end_date}
            min={values.start_date || undefined}
            onChange={(e) => set("end_date", e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Instructions"
        error={errors.instructions}
        hint="As given by your prescriber, e.g. take after food"
      >
        <Textarea
          value={values.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          rows={2}
        />
      </Field>
      <Checkbox
        label="Send dose reminders"
        description="Get a notification at each scheduled time."
        checked={values.reminders_enabled}
        onChange={(e) => set("reminders_enabled", e.target.checked)}
        disabled={asNeeded}
      />
      <Field label="Notes" error={errors.notes}>
        <Textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </Field>
      <ProviderSelect
        label="Prescribed by"
        value={values.prescribed_by}
        onChange={(id) => set("prescribed_by", id)}
        error={errors.prescribed_by}
      />
      <MedicalDisclaimer>{MEDICATION_DISCLAIMER}</MedicalDisclaimer>
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {medication ? "Save changes" : "Add medication"}
        </Button>
      </FormActions>
    </form>
  );
}
