"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/layout/AuthCard";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage, parseApiError } from "@/lib/api/errors";
import { useLoginMutation, useResendVerificationMutation } from "@/services/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { sessionEstablished } from "@/store/slices/authSlice";

import { safeNext, validateEmail } from "./validation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const [login, { isLoading, error }] = useLoginMutation();
  const [resend, { isLoading: resending }] = useResendVerificationMutation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const errorCode = parseApiError(error)?.code;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const result = await login({ email: email.trim(), password }).unwrap();
      dispatch(sessionEstablished(result));
      router.replace(next);
    } catch {
      /* rendered below */
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your health information."
      footer={
        <>
          New to HealthOS?{" "}
          <Link href="/signup" className="text-brand-700 font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && errorCode === "EMAIL_NOT_VERIFIED" && (
          <Alert
            tone="warning"
            title="Verify your email first"
            action={
              <Button
                size="sm"
                variant="secondary"
                loading={resending}
                onClick={async () => {
                  await resend({ email })
                    .unwrap()
                    .catch(() => undefined);
                  toast.success("If your account needs verification, a new link is on its way.");
                }}
              >
                Resend link
              </Button>
            }
          >
            We sent a verification link when you signed up.
          </Alert>
        )}
        {error && errorCode === "ACCOUNT_DEACTIVATED" && (
          <Alert tone="warning" title="Account deactivated">
            You deactivated this account.{" "}
            <Link href="/reactivate" className="font-medium underline">
              Request a reactivation link
            </Link>
            .
          </Alert>
        )}
        {error && errorCode !== "EMAIL_NOT_VERIFIED" && errorCode !== "ACCOUNT_DEACTIVATED" && (
          <Alert tone="error">{getErrorMessage(error)}</Alert>
        )}
        <Field label="Email" required error={fieldErrors.email}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" required error={fieldErrors.password}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-brand-700 text-sm font-medium hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
