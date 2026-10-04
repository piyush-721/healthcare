"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthCard } from "@/components/layout/AuthCard";
import { Alert, Button, Checkbox, Field, Input } from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { useRegisterMutation } from "@/services/auth";

import { MIN_PASSWORD_LENGTH, validateEmail, validateNewPassword } from "./validation";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function SignupForm() {
  const [register, { isLoading, error }] = useRegisterMutation();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const serverErrors = getFieldErrors(error);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = { ...validateNewPassword(form.password, form.confirm) };
    if (!form.full_name.trim()) next.full_name = "Enter your name.";
    const emailError = validateEmail(form.email);
    if (emailError) next.email = emailError;
    if (!accepted) next.accepted = "Please confirm you understand how HealthOS works.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        timezone: browserTimezone(),
      }).unwrap();
      setSubmittedEmail(form.email.trim());
    } catch {
      /* rendered below */
    }
  };

  if (submittedEmail) {
    return (
      <AuthCard title="Check your inbox">
        <div className="flex flex-col items-center text-center">
          <div className="bg-brand-50 text-brand-700 mb-4 rounded-full p-3">
            <MailCheck className="size-7" aria-hidden />
          </div>
          <p className="text-sm text-slate-600">
            We sent a verification link to{" "}
            <strong className="text-slate-900">{submittedEmail}</strong>. Open it to activate your
            account, then sign in.
          </p>
          <Link href="/login" className="text-brand-700 mt-6 text-sm font-medium hover:underline">
            Go to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  const fieldError = (name: string) => errors[name] ?? serverErrors[name];
  const nonField = error && !Object.keys(serverErrors).length ? getErrorMessage(error) : null;

  return (
    <AuthCard
      title="Create your account"
      description="Your health, organized in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-brand-700 font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {nonField && <Alert tone="error">{nonField}</Alert>}
        <Field label="Full name" required error={fieldError("full_name")}>
          <Input
            autoComplete="name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Field>
        <Field label="Email" required error={fieldError("email")}>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field
          label="Password"
          required
          error={fieldError("password")}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. Avoid common or easily guessed passwords.`}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Confirm password" required error={fieldError("confirm")}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <div>
          <Checkbox
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label="I understand HealthOS organizes my information and does not provide medical advice."
          />
          {errors.accepted && (
            <p className="mt-1 text-xs font-medium text-red-700" role="alert">
              {errors.accepted}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
