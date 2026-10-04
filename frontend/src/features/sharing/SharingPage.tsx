"use client";

import { ChevronRight, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useSharesQuery } from "@/services/sharing";

import { SCOPE_LABELS, ShareStateBadge } from "./constants";
import { CreateShareDialog } from "./CreateShareDialog";

const PAGE_SIZE = 20;

export function SharingPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useSharesQuery({ page });
  const { profiles, profile: active } = useActiveProfile();
  const owned = profiles.filter((p) => p.access_role === "OWNER");

  const createButton = (
    <Button
      onClick={() => setCreateOpen(true)}
      icon={<Share2 className="size-4" aria-hidden />}
      disabled={!owned.length}
    >
      Share health information
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sharing with providers"
        description="Give a doctor or clinic temporary, read-only access to selected health information."
        actions={createButton}
      />
      <Alert tone="info" title="You stay in control">
        Each link expires automatically, can be revoked at any time, and every view is logged.
      </Alert>
      <Card>
        <QueryState
          query={query}
          isEmpty={(data) => data.results.length === 0}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="You haven't shared anything yet"
              description="Create a secure link before an appointment so your doctor can review your records."
              action={createButton}
            />
          }
        >
          {(data) => (
            <>
              <ul className="divide-y divide-slate-100">
                {data.results.map((share) => (
                  <li key={share.id}>
                    <Link
                      href={`/sharing/${share.id}`}
                      className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 sm:px-5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {share.recipient_name}
                          </span>
                          <ShareStateBadge state={share.state} />
                        </div>
                        <p className="text-xs text-slate-500">
                          {[share.profile_name, share.recipient_email, share.purpose]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="text-sm text-slate-700">
                          {share.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(", ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {share.state === "REVOKED"
                            ? `Revoked ${formatDateTime(share.revoked_at)}`
                            : share.state === "EXPIRED"
                              ? `Expired ${formatDateTime(share.expires_at)}`
                              : `Expires ${formatRelative(share.expires_at)} (${formatDateTime(share.expires_at)})`}
                          {" · "}
                          {share.access_count === 0
                            ? "Not viewed yet"
                            : `Viewed ${share.access_count} time${share.access_count === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </QueryState>
      </Card>
      <CreateShareDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        profiles={owned}
        defaultProfileId={active?.access_role === "OWNER" ? active.id : undefined}
      />
    </div>
  );
}
