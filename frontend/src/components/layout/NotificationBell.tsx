"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import { useUnreadCountQuery } from "@/services/notifications";

export function NotificationBell() {
  const { data } = useUnreadCountQuery(undefined, { pollingInterval: 60_000 });
  const unread = data?.unread ?? 0;
  return (
    <Link
      href="/notifications"
      className="relative grid size-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-4 font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
