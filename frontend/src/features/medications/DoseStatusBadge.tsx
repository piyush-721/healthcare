import { Badge } from "@/components/ui";
import { humanize } from "@/lib/format";

import { DOSE_STATUS } from "./constants";

export function DoseStatusBadge({ status }: { status: string }) {
  const meta = DOSE_STATUS[status] ?? { label: humanize(status), tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
