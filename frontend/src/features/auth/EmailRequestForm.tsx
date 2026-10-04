"use client";

import { useState, type FormEvent } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { getErrorMessage } from "@/lib/api/errors";

import { validateEmail } from "./validation";

/** "Enter your email and we'll send a link" — always responds generically to avoid account enumeration. */
export function EmailRequestForm({
  submit,
  submitLabel,
  sentMessage,
}: {
  submit: (email: string) => Promise<unknown>;
  submitLabel: string;
  sentMessage: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateEmail(email);
    setError(validation);
    if (validation) return;
    setLoading(true);
    setServerError(null);
    try {
      await submit(email.trim());
      setSent(true);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) return <Alert tone="success">{sentMessage}</Alert>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <Field label="Email" required error={error}>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
