import type { Metadata } from "next";

import { LabReportsPage } from "@/features/labs/LabReportsPage";

export const metadata: Metadata = { title: "Lab reports" };

export default function Page() {
  return <LabReportsPage />;
}
