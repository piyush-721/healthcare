import type { Metadata } from "next";

import { AdminOverviewPage } from "@/features/admin/AdminOverviewPage";

export const metadata: Metadata = { title: "Admin overview" };

export default function Page() {
  return <AdminOverviewPage />;
}
