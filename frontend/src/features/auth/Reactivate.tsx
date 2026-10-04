"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AuthCard } from "@/components/layout/AuthCard";
import { useConfirmReactivationMutation, useRequestReactivationMutation } from "@/services/auth";

import { EmailRequestForm } from "./EmailRequestForm";
import { TokenActionPage } from "./TokenActionPage";

export function Reactivate() {
  const [confirm] = useConfirmReactivationMutation();
  const [request] = useRequestReactivationMutation();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const action = useCallback((token: string) => confirm({ token }).unwrap(), [confirm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only URL fragment
    setHasToken(window.location.hash.includes("token="));
  }, []);

  const requestForm = (
    <EmailRequestForm
      submit={(email) => request({ email }).unwrap()}
      submitLabel="Send reactivation link"
      sentMessage="If the account is deactivated, we've emailed a reactivation link. It expires in 24 hours."
    />
  );

  if (hasToken === null) return null;
  if (hasToken) {
    return (
      <TokenActionPage
        title="Reactivate your account"
        action={action}
        successCta={{ href: "/login", label: "Sign in" }}
        failure={<div className="text-left">{requestForm}</div>}
      />
    );
  }
  return (
    <AuthCard
      title="Reactivate your account"
      description="Accounts you deactivated yourself can be restored by email."
      footer={
        <Link href="/login" className="text-brand-700 font-medium hover:underline">
          Back to sign in
        </Link>
      }
    >
      {requestForm}
    </AuthCard>
  );
}
