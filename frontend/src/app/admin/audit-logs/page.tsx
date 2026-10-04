import type { Metadata } from "next";

import { AuditLogsPage } from "@/features/admin/AuditLogsPage";

export const metadata: Metadata = { title: "Audit logs · Admin" };

export default function Page() {
  return <AuditLogsPage />;
}
