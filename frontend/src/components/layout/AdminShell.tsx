"use client";

import { ArrowLeft, ScrollText, ShieldCheck, Users, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo href="/admin" className="[&_span.text-brand-700]:text-brand-300 text-white" />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">
            <ShieldCheck className="size-3.5" aria-hidden /> Admin
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1 text-sm text-slate-300 hover:text-white sm:inline-flex"
            >
              <ArrowLeft className="size-4" aria-hidden /> Back to HealthOS
            </Link>
            <UserMenu />
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex gap-1">
            {ADMIN_NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                      active
                        ? "border-brand-300 text-white"
                        : "border-transparent text-slate-400 hover:text-white",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden /> {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="mb-4 text-xs text-slate-500">
          The admin console shows account and audit metadata only. Administrators have no access to
          members&apos; health information.
        </p>
        {children}
      </main>
    </div>
  );
}
