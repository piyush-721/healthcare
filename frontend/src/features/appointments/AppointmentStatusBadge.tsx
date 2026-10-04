import { Badge } from "@/components/ui";
import type { Appointment } from "@/types/api";

import { appointmentStatus } from "./constants";

export function AppointmentStatusBadge({
  appointment,
}: {
  appointment: Pick<Appointment, "status" | "needs_update">;
}) {
  const { label, tone } = appointmentStatus(appointment);
  return <Badge tone={tone}>{label}</Badge>;
}
