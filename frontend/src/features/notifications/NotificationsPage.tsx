"use client";

import { BellOff, CheckCheck, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Pagination,
  QueryState,
  Tabs,
  type BadgeTone,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/services/notifications";
import type { Notification } from "@/types/api";

export const CATEGORY_META: Record<string, { label: string; tone: BadgeTone }> = {
  APPOINTMENT_REMINDER: { label: "Appointment", tone: "info" },
  MEDICATION_REMINDER: { label: "Medication", tone: "brand" },
  TREATMENT: { label: "Treatment", tone: "neutral" },
  SHARING: { label: "Sharing", tone: "warning" },
  SECURITY: { label: "Security", tone: "danger" },
};

export function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? { label: category, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const unread = !notification.is_read;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 sm:px-5",
          unread && "bg-brand-50/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            unread ? "bg-brand-700" : "bg-transparent",
          )}
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={notification.category} />
            {unread && <Badge tone="brand">New</Badge>}
            <time
              dateTime={notification.created_at}
              title={formatDateTime(notification.created_at)}
              className="text-xs text-slate-500"
            >
              {formatRelative(notification.created_at)}
            </time>
          </span>
          <span
            className={cn("block text-sm text-slate-900", unread ? "font-semibold" : "font-medium")}
          >
            {notification.title}
          </span>
          {notification.body && (
            <span className="block text-sm text-slate-600">{notification.body}</span>
          )}
        </span>
      </button>
    </li>
  );
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const query = useNotificationsQuery({ page, unread: filter === "unread" ? true : undefined });
  const { data: unreadData } = useUnreadCountQuery();
  const [markRead] = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();
  const router = useRouter();
  const toast = useToast();
  const unread = unreadData?.unread ?? 0;

  const open = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await markRead(n.id).unwrap();
      } catch {
        /* Opening the link matters more than the read flag. */
      }
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Reminders and updates about your health information and account."
        actions={
          <>
            <LinkButton
              href="/settings/notifications"
              variant="secondary"
              icon={<Settings className="size-4" aria-hidden />}
            >
              Preferences
            </LinkButton>
            <Button
              variant="secondary"
              loading={markingAll}
              disabled={unread === 0}
              icon={<CheckCheck className="size-4" aria-hidden />}
              onClick={async () => {
                try {
                  const result = await markAllRead().unwrap();
                  toast.success(
                    result.updated
                      ? `Marked ${result.updated} notification${result.updated === 1 ? "" : "s"} as read.`
                      : "You're all caught up.",
                  );
                } catch (err) {
                  toast.error(err);
                }
              }}
            >
              Mark all as read
            </Button>
          </>
        }
      />
      <Card>
        <div className="px-4 pt-2 sm:px-5">
          <Tabs
            label="Filter notifications"
            items={[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread", count: unread },
            ]}
            value={filter}
            onChange={(id) => {
              setFilter(id === "unread" ? "unread" : "all");
              setPage(1);
            }}
          />
        </div>
        <QueryState
          query={query}
          isEmpty={(data) => data.results.length === 0}
          empty={
            <EmptyState
              icon={BellOff}
              title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
              description={
                filter === "unread"
                  ? "You're all caught up."
                  : "Reminders for appointments, medications and sharing activity will appear here."
              }
              action={
                filter === "unread" ? (
                  <Button variant="secondary" onClick={() => setFilter("all")}>
                    View all notifications
                  </Button>
                ) : undefined
              }
            />
          }
        >
          {(data) => (
            <>
              <ul className="divide-y divide-slate-100" aria-label="Notifications">
                {data.results.map((n) => (
                  <NotificationRow key={n.id} notification={n} onOpen={() => open(n)} />
                ))}
              </ul>
              <Pagination page={page} count={data.count} onChange={setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
