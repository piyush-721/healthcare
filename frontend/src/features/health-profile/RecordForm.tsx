"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { isoToLocalInput, localInputToISO } from "@/lib/format";

/**
 * A small declarative form system for the profile-scoped health collections
 * (allergies, conditions, vitals…). Each collection declares its fields once
 * and gets add/edit dialogs, client validation and server field errors.
 */
export type FieldKind =
  "text" | "textarea" | "date" | "datetime" | "number" | "select" | "checkbox" | "email" | "tel";

export type FormValues = Record<string, string | boolean>;

export type FieldDef = {
  name: string;
  label: string;
  /** Optional label that depends on other values (e.g. "Systolic" for blood pressure). */
  labelFor?: (values: FormValues) => string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Placeholder option for selects; when set, "" maps to null/blank. */
  emptyOption?: string;
  hint?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  full?: boolean;
  /** Value sent when the field is blank (default: null for dates/numbers/datetimes, "" otherwise). */
  blankValue?: string | null;
  visible?: (values: FormValues) => boolean;
};

const NULLABLE_KINDS: FieldKind[] = ["date", "datetime", "number"];

export function isVisible(field: FieldDef, values: FormValues) {
  return field.visible ? field.visible(values) : true;
}

export function emptyValues(fields: FieldDef[], defaults: FormValues = {}): FormValues {
  const values: FormValues = {};
  for (const field of fields) values[field.name] = field.kind === "checkbox" ? false : "";
  return { ...values, ...defaults };
}

/** API item → form values. */
export function valuesFromItem(fields: FieldDef[], item: Record<string, unknown>): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const raw = item[field.name];
    if (field.kind === "checkbox") values[field.name] = raw === true;
    else if (field.kind === "datetime")
      values[field.name] = typeof raw === "string" ? isoToLocalInput(raw) : "";
    else if (raw === null || raw === undefined) values[field.name] = "";
    else values[field.name] = String(raw);
  }
  return values;
}

/** Form values → API body. Hidden fields are cleared. */
export function bodyFromValues(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.kind === "checkbox") {
      body[field.name] = value === true;
      continue;
    }
    const text = typeof value === "string" ? value.trim() : "";
    const blank =
      field.blankValue !== undefined
        ? field.blankValue
        : NULLABLE_KINDS.includes(field.kind)
          ? null
          : "";
    if (!isVisible(field, values) || text === "") body[field.name] = blank;
    else if (field.kind === "datetime") body[field.name] = localInputToISO(text);
    else body[field.name] = text;
  }
  return body;
}

export function validateRequired(fields: FieldDef[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.required || field.kind === "checkbox" || !isVisible(field, values)) continue;
    const value = values[field.name];
    if (typeof value !== "string" || value.trim() === "")
      errors[field.name] = `${field.labelFor?.(values) ?? field.label} is required.`;
  }
  return errors;
}

/** Renders the controls for a list of field definitions in a responsive grid. */
export function RecordFields({
  fields,
  values,
  errors,
  onChange,
  disabled,
}: {
  fields: FieldDef[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: string | boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields
        .filter((field) => isVisible(field, values))
        .map((field) => {
          const full = field.full || field.kind === "textarea" || field.kind === "checkbox";
          const value = values[field.name];
          const text = typeof value === "string" ? value : "";
          if (field.kind === "checkbox") {
            return (
              <Checkbox
                key={field.name}
                className="sm:col-span-2"
                label={field.label}
                description={field.hint}
                checked={value === true}
                disabled={disabled}
                onChange={(event) => onChange(field.name, event.target.checked)}
              />
            );
          }
          const inputType =
            field.kind === "datetime"
              ? "datetime-local"
              : field.kind === "number"
                ? "number"
                : field.kind;
          const control =
            field.kind === "textarea" ? (
              <Textarea
                value={text}
                placeholder={field.placeholder}
                disabled={disabled}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            ) : field.kind === "select" ? (
              <Select
                value={text}
                options={field.options ?? []}
                placeholder={field.emptyOption}
                disabled={disabled}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            ) : (
              <Input
                type={inputType}
                value={text}
                step={field.step}
                min={field.min}
                inputMode={field.kind === "number" ? "decimal" : undefined}
                placeholder={field.placeholder}
                disabled={disabled}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            );
          return (
            <Field
              key={field.name}
              label={field.labelFor?.(values) ?? field.label}
              required={field.required}
              hint={field.hint}
              error={errors[field.name]}
              className={cn(full && "sm:col-span-2")}
            >
              {control}
            </Field>
          );
        })}
    </div>
  );
}

/** Add/edit dialog driven by field definitions. `onSubmit` should throw the RTK error on failure. */
export function RecordFormDialog({
  open,
  onClose,
  title,
  description,
  fields,
  initialValues,
  submitLabel = "Save",
  onSubmit,
  validate,
  transform,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  fields: FieldDef[];
  initialValues: FormValues;
  submitLabel?: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
  validate?: (values: FormValues) => Record<string, string>;
  /** Adjust values when one changes (e.g. default the unit for a vital type). */
  transform?: (values: FormValues, changed: string) => FormValues;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="lg">
      {open && (
        <RecordFormBody
          fields={fields}
          initialValues={initialValues}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onCancel={onClose}
          validate={validate}
          transform={transform}
        />
      )}
    </Dialog>
  );
}

function RecordFormBody({
  fields,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  validate,
  transform,
}: {
  fields: FieldDef[];
  initialValues: FormValues;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
  onCancel: () => void;
  validate?: (values: FormValues) => Record<string, string>;
  transform?: (values: FormValues, changed: string) => FormValues;
}) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleChange = (name: string, value: string | boolean) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      return transform ? transform(next, name) : next;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const rest = { ...prev };
      delete rest[name];
      return rest;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = { ...validateRequired(fields, values), ...(validate?.(values) ?? {}) };
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(bodyFromValues(fields, values));
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      const known = Object.keys(fieldErrors).filter((key) => fields.some((f) => f.name === key));
      setErrors(fieldErrors);
      if (!known.length) toast.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <RecordFields
        fields={fields}
        values={values}
        errors={errors}
        onChange={handleChange}
        disabled={submitting}
      />
      <FormActions>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
