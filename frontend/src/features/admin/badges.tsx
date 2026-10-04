import { Badge, type BadgeTone } from "@/components/ui";
import { humanize } from "@/lib/format";

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  DEACTIVATED: "neutral",
};

export function UserStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{humanize(status)}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge tone={role === "ADMIN" ? "info" : "neutral"}>
      {role === "ADMIN" ? "Admin" : "User"}
    </Badge>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Badge tone="brand">Verified</Badge> : <Badge tone="warning">Unverified</Badge>;
}

/** Compact JSON for audit metadata; empty objects render as nothing. */
export function MetadataCell({ metadata }: { metadata: unknown }) {
  if (metadata === null || metadata === undefined) return <span className="text-slate-400">—</span>;
  if (typeof metadata === "object" && Object.keys(metadata).length === 0)
    return <span className="text-slate-400">—</span>;
  const json = JSON.stringify(metadata);
  return (
    <details className="max-w-xs">
      <summary className="text-brand-700 cursor-pointer text-xs font-medium">
        {json.length > 40 ? `${json.slice(0, 40)}…` : json}
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 font-mono text-xs break-all whitespace-pre-wrap text-slate-700">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  );
}
