import { AdminShell } from "@/components/layout/AdminShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
