import { Bell, ChevronRight, Shield, User, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";

const LINKS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    href: "/profile",
    title: "Account",
    description: "Your name, email and time zone.",
    icon: User,
  },
  {
    href: "/settings/security",
    title: "Security",
    description: "Password, signed-in devices, security activity and account deactivation.",
    icon: Shield,
  },
  {
    href: "/settings/notifications",
    title: "Notifications",
    description: "Choose which reminders and updates you get by email or in the app.",
    icon: Bell,
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, security and notifications." />
      <ul className="grid gap-4 md:grid-cols-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Card className="hover:border-brand-300 h-full transition-colors">
              <Link href={link.href} className="flex h-full items-start gap-3 p-4 sm:p-5">
                <span className="bg-brand-50 text-brand-700 rounded-lg p-2">
                  <link.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-slate-900">{link.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{link.description}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
