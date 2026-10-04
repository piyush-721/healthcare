import { ArrowDown, ArrowUp, Minus, ScanText } from "lucide-react";

import { Badge } from "@/components/ui";

/**
 * Neutral wording only: position relative to the range printed on the report.
 * HealthOS never labels a value as good, bad, normal or abnormal.
 */
export const RANGE_LABELS: Record<string, string> = {
  BELOW: "Below report range",
  WITHIN: "Within report range",
  ABOVE: "Above report range",
};

export function rangeLabel(position: string | null | undefined): string | null {
  if (!position) return null;
  return RANGE_LABELS[position] ?? null;
}

export function RangeBadge({ position }: { position: string | null | undefined }) {
  const label = rangeLabel(position);
  if (!label) return null;
  const Icon = position === "BELOW" ? ArrowDown : position === "ABOVE" ? ArrowUp : Minus;
  return (
    <Badge tone="neutral">
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

export function MachineExtractedBadge() {
  return (
    <Badge tone="warning">
      <ScanText className="size-3" aria-hidden />
      Machine-extracted — verify
    </Badge>
  );
}

/** "3.5–5.0", "≥ 3.5", "≤ 5.0" or the printed reference text. */
export function formatRange(
  low?: string | null,
  high?: string | null,
  text?: string | null,
): string {
  if (low && high) return `${trimNumber(low)}–${trimNumber(high)}`;
  if (low) return `≥ ${trimNumber(low)}`;
  if (high) return `≤ ${trimNumber(high)}`;
  return text || "—";
}

/** "5.2000" → "5.2" for display; leaves non-numbers untouched. */
export function trimNumber(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) && value.trim() !== "" ? String(n) : value;
}
