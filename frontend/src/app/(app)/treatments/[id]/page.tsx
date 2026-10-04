import type { Metadata } from "next";

import { TreatmentPlanDetailPage } from "@/features/treatments/TreatmentPlanDetailPage";

export const metadata: Metadata = { title: "Treatment plan" };

export default function Page() {
  return <TreatmentPlanDetailPage />;
}
