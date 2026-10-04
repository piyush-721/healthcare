import type { Metadata } from "next";

import { VerifyEmail } from "@/features/auth/VerifyEmail";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return <VerifyEmail />;
}
