"use client";

import { Menu, MoreHorizontal, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Alert } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/cn";
import { useAppSelector } from "@/store/hooks";

import { Logo } from "./Logo";
import { ACCOUNT_NAV, MOBILE_TABS, PRIMARY_NAV, isActive, type NavItem } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { UserMenu } from "./UserMenu";

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useActiveProfile();
  return (
    <ul className="space-y-0.5">
      {items
        .filter((item) => !item.permission || can(item.permission))
        .map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <item.icon
                  className={cn("size-[18px]", active ? "text-brand-700" : "text-slate-400")}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const isAdmin = useAppSelector((state) => state.auth.user?.is_platform_admin);
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <NavLinks items={PRIMARY_NAV} onNavigate={onNavigate} />
      <div>
        <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Account
        </p>
        <NavLinks items={ACCOUNT_NAV} onNavigate={onNavigate} />
      </div>
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="mt-auto flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ShieldCheck className="size-[18px] text-slate-400" aria-hidden /> Admin console
        </Link>
      )}
    </nav>
  );
}

function CaregiverBanner() {
  const { profile } = useActiveProfile();
  if (!profile || profile.is_self) return null;
  return (
    <Alert tone="info" className="mb-4">
      You&apos;re viewing <strong>{profile.full_name}</strong>&apos;s health information
      {profile.access_role === "CAREGIVER"
        ? ` as a caregiver for ${profile.owner_name}.`
        : " as their guardian."}
    </Alert>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { can } = useActiveProfile();

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/dashboard" />
        </div>
        <div className="px-3">
          <ProfileSwitcher />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo href="/dashboard" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:h-16 lg:px-8">
          <button
            type="button"
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="lg:hidden">
            <Logo href="/dashboard" className="max-[380px]:[&>span:last-child]:hidden" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="lg:hidden">
              <ProfileSwitcher compact />
            </div>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-12">
          <CaregiverBanner />
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.filter((tab) => !tab.permission || can(tab.permission)).map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                    active ? "text-brand-700" : "text-slate-500",
                  )}
                >
                  <tab.icon className="size-5" aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
