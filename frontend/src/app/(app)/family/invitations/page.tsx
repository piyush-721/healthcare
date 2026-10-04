import type { Metadata } from "next";

import { InvitationsPage } from "@/features/family/InvitationsPage";

export const metadata: Metadata = { title: "Caregiver invitations" };

export default function Page() {
  return <InvitationsPage />;
}
