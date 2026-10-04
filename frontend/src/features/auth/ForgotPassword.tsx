"use client";

import Link from "next/link";

import { AuthCard } from "@/components/layout/AuthCard";
import { useForgotPasswordMutation } from "@/services/auth";

import { EmailRequestForm } from "./EmailRequestForm";

export function ForgotPassword() {
  const [forgot] = useForgotPasswordMutation();
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/login" className="text-brand-700 font-medium hover:underline">
          Back to sign in
        </Link>
      }
    >
      <EmailRequestForm
        submit={(email) => forgot({ email }).unwrap()}
        submitLabel="Send reset link"
        sentMessage="If an account exists for that email, you'll receive a reset link shortly. It expires in 1 hour."
      />
    </AuthCard>
  );
}
