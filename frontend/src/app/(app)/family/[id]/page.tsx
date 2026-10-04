import type { Metadata } from "next";

import { MemberDetailPage } from "@/features/family/MemberDetailPage";

export const metadata: Metadata = { title: "Family member" };

export default function Page() {
  return <MemberDetailPage />;
}
