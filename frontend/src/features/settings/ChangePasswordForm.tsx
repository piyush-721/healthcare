"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Alert, Button, Field, FormActions, Input } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { useChangePasswordMutation } from "@/services/auth";

export const MIN_PASSWORD_LENGTH = 10;

type Values = { current: string; next: string; confirm: string };

export function validatePasswordChange({ current, next, confirm }: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!current) errors.current_password = "Enter your current password.";
  if (next.length < MIN_PASSWORD_LENGTH)
    errors.new_password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (next === current)
    errors.new_password = "Choose a password different from your current one.";
  if (!confirm) errors.confirm = "Re-enter your new password.";
  else if (confirm !== next) errors.confirm = "Passwords don't match.";
  return errors;
}

export function ChangePasswordForm() {
  const [values, setValues] = useState<Values>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [changePassword, { isLoading, error }] = useChangePasswordMutation();
  const toast = useToast();
  const hasFieldErrors = Object.keys(getFieldErrors(error)).length > 0;

  const update = (key: keyof Values) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validatePasswordChange(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    try {
      await changePassword({
        current_password: values.current,
        new_password: values.next,
      }).unwrap();
      setValues({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other devices have been signed out.");
    } catch (err) {
      setErrors(getFieldErrors(err));
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-md space-y-4">
      {error && !hasFieldErrors ? <Alert tone="error">{getErrorMessage(error)}</Alert> : null}
      <Field label="Current password" required error={errors.current_password}>
        <Input
          type="password"
          autoComplete="current-password"
          value={values.current}
          onChange={update("current")}
        />
      </Field>
      <Field
        label="New password"
        required
        error={errors.new_password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short phrase is easier to remember.`}
      >
        <Input
          type="password"
          autoComplete="new-password"
          value={values.next}
          onChange={update("next")}
        />
      </Field>
      <Field label="Confirm new password" required error={errors.confirm}>
        <Input
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update("confirm")}
        />
      </Field>
      <FormActions className="sm:justify-start">
        <Button type="submit" loading={isLoading}>
          Change password
        </Button>
      </FormActions>
    </form>
  );
}
