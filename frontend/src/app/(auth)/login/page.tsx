import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginForm />
    </Suspense>
  );
}
