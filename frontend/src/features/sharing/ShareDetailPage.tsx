"use client";

import { Ban, ScrollText } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  QueryState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useRevokeShareMutation, useShareAccessLogsQuery, useShareQuery } from "@/services/sharing";

import { OutcomeBadge, SCOPE_LABELS, ShareStateBadge, sectionLabel } from "./constants";

function AccessLog({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useShareAccessLogsQuery({ id, page });
  return (
    <Card>
      <CardHeader
        title="Access log"
        description="Every time the link is used, it's recorded here."
      />
      <QueryState
        query={query}
        isEmpty={(data) => data.results.length === 0}
        empty={
          <EmptyState
            icon={ScrollText}
            title="No access yet"
            description="The recipient hasn't opened the link."
          />
        }
      >
        {(data) => (
          <>
            <div className="hidden sm:block">
              <Table caption="Share access log">
                <THead>
                  <tr>
                    <Th>When</Th>
                    <Th>Section</Th>
                    <Th>Outcome</Th>
                    <Th>IP address</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.results.map((log) => (
                    <Tr key={log.id}>
                      <Td>
                        <time dateTime={log.accessed_at} title={formatRelative(log.accessed_at)}>
                          {formatDateTime(log.accessed_at)}
                        </time>
                      </Td>
                      <Td>{sectionLabel(log.section)}</Td>
                      <Td>
                        <OutcomeBadge outcome={log.outcome} />
                      </Td>
                      <Td className="font-mono text-xs">{log.ip_address || "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data.results.map((log) => (
                <li key={log.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {sectionLabel(log.section)}
                    </span>
                    <OutcomeBadge outcome={log.outcome} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(log.accessed_at)}
                    {log.ip_address ? ` · ${log.ip_address}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

export function ShareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useShareQuery(id, { skip: !id });
  const [revoke, { isLoading: revoking }] = useRevokeShareMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();
  const back = { href: "/sharing", label: "Sharing" };

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return (
      <div>
        <PageHeader title="Share" back={back} />
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      </div>
    );
  }

  const share = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={`Shared with ${share.recipient_name}`}
        badge={<ShareStateBadge state={share.state} />}
        description={`${share.profile_name}'s information · created ${formatDateTime(share.created_at)}`}
        actions={
          share.state === "ACTIVE" ? (
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              icon={<Ban className="size-4" aria-hidden />}
            >
              Revoke access
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <DetailList
            items={[
              { label: "Recipient", value: share.recipient_name },
              { label: "Recipient email", value: share.recipient_email },
              { label: "Purpose", value: share.purpose },
              {
                label: "Shared information",
                value: (
                  <ul className="flex flex-wrap gap-1.5">
                    {share.scopes.map((s) => (
                      <li key={s}>
                        <Badge tone="brand">{SCOPE_LABELS[s] ?? s}</Badge>
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                label: share.state === "EXPIRED" ? "Expired" : "Expires",
                value: `${formatDateTime(share.expires_at)} (${formatRelative(share.expires_at)})`,
              },
              ...(share.revoked_at
                ? [
                    {
                      label: "Revoked",
                      value: `${formatDateTime(share.revoked_at)}${share.revoked_by_name ? ` by ${share.revoked_by_name}` : ""}`,
                    },
                  ]
                : []),
              { label: "Times accessed", value: String(share.access_count) },
              {
                label: "Last accessed",
                value: share.last_accessed_at ? formatDateTime(share.last_accessed_at) : "Never",
              },
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">
            For your security the link itself can&apos;t be shown again. If it was lost, revoke this
            share and create a new one.
          </p>
        </CardBody>
      </Card>
      <AccessLog id={share.id} />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Revoke this share link?"
        message={`${share.recipient_name} will immediately lose access. This can't be undone — you'd need to create a new link to share again.`}
        confirmLabel="Revoke access"
        loading={revoking}
        onConfirm={async () => {
          try {
            await revoke(share.id).unwrap();
            toast.success("Share link revoked.");
            setConfirmOpen(false);
          } catch (err) {
            toast.error(err);
          }
        }}
      />
    </div>
  );
}
