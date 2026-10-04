"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthCard } from "@/components/layout/AuthCard";
import { Alert, Button, Field, Input, LoadingState } from "@/components/ui";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { useResetPasswordMutation } from "@/services/auth";

import { validateNewPassword } from "./validation";

export function ResetPasswordForm() {
  const { token, ready } = useUrlToken();
  const [reset, { isLoading, error, isSuccess }] = useResetPasswordMutation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const server = getFieldErrors(error);

  if (!ready)
    return (
      <AuthCard title="Choose a new password">
        <LoadingState />
      </AuthCard>
    );
  if (!token) {
    return (
      <AuthCard title="Link not valid">
        <Alert tone="error">This reset link is incomplete or has already been used.</Alert>
        <Link
          href="/forgot-password"
          className="text-brand-700 mt-4 inline-block text-sm font-medium hover:underline"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }
  if (isSuccess) {
    return (
      <AuthCard title="Password updated">
        <Alert tone="success">Your password has been reset and all devices were signed out.</Alert>
        <Link
          href="/login"
          className="text-brand-700 mt-4 inline-block text-sm font-medium hover:underline"
        >
          Sign in with your new password
        </Link>
      </AuthCard>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validateNewPassword(password, confirm);
    setErrors(next);
    if (Object.keys(next).length) return;
    await reset({ token, password })
      .unwrap()
      .catch(() => undefined);
  };

  return (
    <AuthCard
      title="Choose a new password"
      description="You'll be signed out of every device after the change."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && !server.password && (
          <Alert tone="error">
            {getErrorMessage(error)}{" "}
            <Link href="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </Alert>
        )}
        <Field label="New password" required error={errors.password ?? server.password}>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password" required error={errors.confirm}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}
