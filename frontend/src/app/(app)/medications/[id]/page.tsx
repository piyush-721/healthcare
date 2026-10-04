import type { Metadata } from "next";

import { MedicationDetailPage } from "@/features/medications/MedicationDetailPage";

export const metadata: Metadata = { title: "Medication" };

export default function Page() {
  return <MedicationDetailPage />;
}
