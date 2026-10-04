import type { Metadata } from "next";

import { TreatmentPlansPage } from "@/features/treatments/TreatmentPlansPage";

export const metadata: Metadata = { title: "Treatment plans" };

export default function Page() {
  return <TreatmentPlansPage />;
}
