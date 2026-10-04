import type { Metadata } from "next";

import { FamilyPage } from "@/features/family/FamilyPage";

export const metadata: Metadata = { title: "Family" };

export default function Page() {
  return <FamilyPage />;
}
