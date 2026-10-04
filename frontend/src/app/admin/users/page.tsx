import type { Metadata } from "next";

import { AdminUsersPage } from "@/features/admin/AdminUsersPage";

export const metadata: Metadata = { title: "Users · Admin" };

export default function Page() {
  return <AdminUsersPage />;
}
