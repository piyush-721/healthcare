import { Badge } from "@/components/ui";
import type { MedicalDocument } from "@/types/api";

const LABELS: Record<
  MedicalDocument["scan_status"],
  { label: string; tone: "info" | "success" | "danger" | "warning" }
> = {
  PENDING: { label: "Scanning…", tone: "info" },
  CLEAN: { label: "Ready", tone: "success" },
  INFECTED: { label: "Blocked — threat detected", tone: "danger" },
  FAILED: { label: "Scan failed", tone: "warning" },
};

export function ScanStatusBadge({ status }: { status: MedicalDocument["scan_status"] }) {
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
