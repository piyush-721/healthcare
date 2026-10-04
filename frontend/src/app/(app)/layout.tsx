import { Suspense } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ProfileUrlSync } from "@/components/layout/ProfileUrlSync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <ProfileUrlSync />
      </Suspense>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
