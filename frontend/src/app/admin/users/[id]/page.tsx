import type { Metadata } from "next";

import { AdminUserDetailPage } from "@/features/admin/AdminUserDetailPage";

export const metadata: Metadata = { title: "User · Admin" };

export default function Page() {
  return <AdminUserDetailPage />;
}
