import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  LayoutDashboard,
  Pill,
  Settings,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/types/api";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: History },
  {
    href: "/health-profile",
    label: "Health profile",
    icon: HeartPulse,
    permission: "VIEW_PROFILE",
  },
  { href: "/records", label: "Records", icon: FileText, permission: "VIEW_DOCUMENTS" },
  { href: "/medications", label: "Medications", icon: Pill, permission: "VIEW_MEDICATIONS" },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarDays,
    permission: "VIEW_APPOINTMENTS",
  },
  { href: "/labs", label: "Lab reports", icon: FlaskConical, permission: "VIEW_LAB_RESULTS" },
  {
    href: "/treatments",
    label: "Treatment plans",
    icon: ClipboardList,
    permission: "VIEW_TREATMENT_PLANS",
  },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/family", label: "Family", icon: Users },
  { href: "/sharing", label: "Sharing", icon: Share2 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/medications", label: "Meds", icon: Pill, permission: "VIEW_MEDICATIONS" },
  { href: "/appointments", label: "Visits", icon: CalendarDays, permission: "VIEW_APPOINTMENTS" },
  { href: "/records", label: "Records", icon: FileText, permission: "VIEW_DOCUMENTS" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
