"use client";

import { useCallback } from "react";

import { useResendVerificationMutation, useVerifyEmailMutation } from "@/services/auth";

import { EmailRequestForm } from "./EmailRequestForm";
import { TokenActionPage } from "./TokenActionPage";

export function VerifyEmail() {
  const [verify] = useVerifyEmailMutation();
  const [resend] = useResendVerificationMutation();
  const action = useCallback((token: string) => verify({ token }).unwrap(), [verify]);
  return (
    <TokenActionPage
      title="Verify your email"
      action={action}
      successCta={{ href: "/login", label: "Continue to sign in" }}
      failure={
        <div className="text-left">
          <p className="mb-3 text-sm text-slate-600">Request a fresh verification link:</p>
          <EmailRequestForm
            submit={(email) => resend({ email }).unwrap()}
            submitLabel="Send new link"
            sentMessage="If your account still needs verification, a new link is on its way."
          />
        </div>
      }
    />
  );
}
