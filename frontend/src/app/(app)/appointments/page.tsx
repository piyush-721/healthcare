import type { Metadata } from "next";

import { AppointmentsPage } from "@/features/appointments/AppointmentsPage";

export const metadata: Metadata = { title: "Appointments" };

export default function Page() {
  return <AppointmentsPage />;
}
