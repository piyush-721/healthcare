import type { Metadata } from "next";

import { SecurityPage } from "@/features/settings/SecurityPage";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecurityPage />;
}
