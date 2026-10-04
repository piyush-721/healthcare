import type { Metadata } from "next";

import { AppointmentDetailPage } from "@/features/appointments/AppointmentDetailPage";

export const metadata: Metadata = { title: "Appointment" };

export default function Page() {
  return <AppointmentDetailPage />;
}
