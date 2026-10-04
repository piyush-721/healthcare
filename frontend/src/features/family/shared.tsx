import { Badge, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { CaregiverAccess } from "@/types/api";

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: "warning",
  ACTIVE: "success",
  DECLINED: "neutral",
  REVOKED: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Invitation pending",
  ACTIVE: "Active",
  DECLINED: "Declined",
  REVOKED: "Revoked",
};

export function AccessStatusBadge({
  access,
}: {
  access: Pick<CaregiverAccess, "status" | "is_expired">;
}) {
  if (access.is_expired) return <Badge tone="neutral">Expired</Badge>;
  const status = access.status ?? "PENDING";
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function Avatar({
  name,
  tone = "slate",
  className,
}: {
  name: string;
  tone?: "brand" | "slate";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
        tone === "brand" ? "bg-brand-100 text-brand-800" : "bg-slate-200 text-slate-700",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function PermissionList({ labels }: { labels: string[] }) {
  if (!labels.length) return <p className="text-sm text-slate-500">No permissions</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Permissions">
      {labels.map((label) => (
        <li key={label}>
          <Badge tone="brand">{label}</Badge>
        </li>
      ))}
    </ul>
  );
}
