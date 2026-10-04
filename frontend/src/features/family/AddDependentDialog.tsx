"use client";

import { useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  toOptions,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { todayISO } from "@/lib/format";
import { useAddDependentMutation } from "@/services/family";

import { SEXES, SEX_LABELS } from "../health-profile/config";
import { RELATIONSHIPS, type Relationship } from "./permissions";

type Sex = (typeof SEXES)[number];

export function AddDependentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a family member"
      description="Create a profile you manage — for a child, parent or anyone you look after."
    >
      {open && <AddDependentForm onDone={onClose} />}
    </Dialog>
  );
}

function AddDependentForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState<Relationship | "">("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<Sex>("UNDISCLOSED");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addDependent, { isLoading, error }] = useAddDependentMutation();
  const toast = useToast();
  const hasFieldErrors = Object.keys(getFieldErrors(error)).length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.full_name = "Enter their full name.";
    if (!relationship) next.relationship_to_owner = "Choose how they're related to you.";
    if (dob && dob > todayISO()) next.date_of_birth = "Date of birth can't be in the future.";
    setErrors(next);
    if (Object.keys(next).length || !relationship) return;
    try {
      const profile = await addDependent({
        full_name: fullName.trim(),
        relationship_to_owner: relationship,
        date_of_birth: dob || null,
        sex,
      }).unwrap();
      toast.success(`${profile.full_name} added to your family.`);
      onDone();
    } catch (err) {
      setErrors(getFieldErrors(err));
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {error && !hasFieldErrors ? <Alert tone="error">{getErrorMessage(error)}</Alert> : null}
      <Field label="Full name" required error={errors.full_name}>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150} />
      </Field>
      <Field label="Relationship to you" required error={errors.relationship_to_owner}>
        <Select
          value={relationship}
          placeholder="Choose…"
          options={toOptions(RELATIONSHIPS)}
          onChange={(e) => setRelationship(e.target.value as Relationship | "")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" error={errors.date_of_birth}>
          <Input
            type="date"
            max={todayISO()}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </Field>
        <Field label="Sex" error={errors.sex}>
          <Select
            value={sex}
            options={toOptions(SEXES, SEX_LABELS)}
            onChange={(e) => setSex(e.target.value as Sex)}
          />
        </Field>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Add family member
        </Button>
      </FormActions>
    </form>
  );
}
