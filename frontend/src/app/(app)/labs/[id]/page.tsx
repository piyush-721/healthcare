import type { Metadata } from "next";

import { LabReportDetailPage } from "@/features/labs/LabReportDetailPage";

export const metadata: Metadata = { title: "Lab report" };

export default function Page() {
  return <LabReportDetailPage />;
}
