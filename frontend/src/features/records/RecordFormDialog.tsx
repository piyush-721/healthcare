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
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { todayISO } from "@/lib/format";
import { useCreateRecordMutation, useUpdateRecordMutation } from "@/services/records";
import type { MedicalRecord } from "@/types/api";

import { RECORD_TYPES, type RecordType } from "./constants";
import { splitFormErrors } from "./formErrors";

type FormState = {
  title: string;
  record_type: RecordType;
  record_date: string;
  provider: string | null;
  description: string;
};

const FIELDS = ["title", "record_type", "record_date", "provider", "description"] as const;

function initialState(record?: MedicalRecord): FormState {
  return {
    title: record?.title ?? "",
    record_type: record?.record_type ?? "CONSULTATION",
    record_date: record?.record_date ?? todayISO(),
    provider: record?.provider ?? null,
    description: record?.description ?? "",
  };
}

/** Create a medical record, or edit one when `record` is given. */
export function RecordFormDialog({
  open,
  onClose,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  record?: MedicalRecord;
  onSaved?: (record: MedicalRecord) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={record ? "Edit record" : "New medical record"}
      size="lg"
    >
      {/* Remount on open so the form starts from the latest values. */}
      {open && <RecordForm record={record} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function RecordForm({
  record,
  onClose,
  onSaved,
}: {
  record?: MedicalRecord;
  onClose: () => void;
  onSaved?: (record: MedicalRecord) => void;
}) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [create, createState] = useCreateRecordMutation();
  const [update, updateState] = useUpdateRecordMutation();
  const saving = createState.isLoading || updateState.isLoading;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!form.title.trim()) local.title = "Enter a title.";
    if (!form.record_date) local.record_date = "Choose a date.";
    setErrors(local);
    if (Object.keys(local).length) return;

    const body = { ...form, title: form.title.trim() };
    try {
      const saved = record
        ? await update({ id: record.id, ...body }).unwrap()
        : await create({ ...body, profile: profileId }).unwrap();
      toast.success(record ? "Record updated." : "Record added.");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const { fields, needsToast } = splitFormErrors(err, FIELDS);
      setErrors(fields);
      if (needsToast) toast.error(err);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Title" required error={errors.title}>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Annual check-up"
          maxLength={200}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required error={errors.record_type}>
          <Select
            value={form.record_type}
            onChange={(e) => set("record_type", e.target.value as RecordType)}
            options={toOptions(RECORD_TYPES)}
          />
        </Field>
        <Field label="Date" required error={errors.record_date}>
          <Input
            type="date"
            value={form.record_date}
            onChange={(e) => set("record_date", e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Description"
        error={errors.description}
        hint="Optional notes about this visit or record."
      >
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
        />
      </Field>
      <ProviderSelect
        value={form.provider}
        onChange={(id) => set("provider", id)}
        error={errors.provider}
      />
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {record ? "Save changes" : "Add record"}
        </Button>
      </FormActions>
    </form>
  );
}
