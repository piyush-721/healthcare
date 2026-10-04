import {
  CalendarDays,
  ClipboardList,
  FileLock2,
  FlaskConical,
  History,
  KeyRound,
  Pill,
  ScrollText,
  Share2,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui";
import { HeaderActions } from "@/features/landing/HeaderActions";

export const metadata: Metadata = {
  title: { absolute: "HealthOS — Your health, organized in one place" },
};

const FEATURES = [
  {
    icon: FileLock2,
    title: "Medical records",
    body: "Prescriptions, discharge summaries and scans stored privately, never on public links.",
  },
  {
    icon: Pill,
    title: "Medications",
    body: "Track what you were prescribed, record doses and get reminders at the right time.",
  },
  {
    icon: CalendarDays,
    title: "Appointments",
    body: "Upcoming visits, notes from the doctor and follow-ups in one calendar.",
  },
  {
    icon: FlaskConical,
    title: "Lab reports",
    body: "Record results with the reference ranges on your report and see trends over time.",
  },
  {
    icon: ClipboardList,
    title: "Treatment plans",
    body: "Turn your doctor's instructions into a checklist so nothing slips.",
  },
  {
    icon: History,
    title: "Health timeline",
    body: "Every consultation, report and change in one chronological view.",
  },
];

const TRUST = [
  {
    icon: Users,
    title: "Family, with explicit permissions",
    body: "Give a caregiver exactly what they need — view medications, manage appointments — never blanket access.",
  },
  {
    icon: Timer,
    title: "Time-limited sharing",
    body: "Share selected sections with a doctor for 24 hours. Revoke any time; every view is logged.",
  },
  {
    icon: KeyRound,
    title: "Security by default",
    body: "Rotating sessions in HttpOnly cookies, rate limiting, malware scanning and least-privilege access.",
  },
  {
    icon: ScrollText,
    title: "A complete audit trail",
    body: "See every sign-in and every time shared data was accessed.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <HeaderActions />
        </div>
      </header>

      <main id="main">
        <section className="from-brand-50/70 border-b border-slate-100 bg-gradient-to-b to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-brand-800 ring-brand-200 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium ring-1">
                <ShieldCheck className="size-3.5" aria-hidden /> Private by design
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Your health, organized in one place.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                Prescriptions in WhatsApp, reports in email, appointments in three different apps.
                HealthOS brings your family&apos;s health information together — and lets you share
                it only on your terms.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton href="/signup" size="lg">
                  Create your free account
                </LinkButton>
                <LinkButton href="/login" size="lg" variant="secondary">
                  Sign in
                </LinkButton>
              </div>
            </div>
            <div aria-hidden className="relative">
              <div className="shadow-brand-900/5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                <p className="text-sm font-semibold text-slate-900">Today</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    ["08:00", "Metformin 500 mg", "Taken"],
                    ["11:30", "Follow-up consultation · City Clinic", "Upcoming"],
                    ["20:00", "Metformin 500 mg", "Scheduled"],
                  ].map(([time, label, state]) => (
                    <li
                      key={time}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
                    >
                      <span className="w-12 font-mono text-xs text-slate-500">{time}</span>
                      <span className="flex-1 text-slate-800">{label}</span>
                      <span className="bg-brand-50 text-brand-800 rounded-full px-2 py-0.5 text-xs font-medium">
                        {state}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <Share2 className="mr-1 inline size-3.5" /> Shared with Dr. Sharma · Medications,
                  Lab reports · expires in 23 h
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="text-2xl font-semibold tracking-tight text-slate-900"
          >
            Everything you need to stay on top of care
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-slate-200 p-5">
                <feature.icon className="text-brand-700 size-6" aria-hidden />
                <h3 className="mt-3 font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 text-white" aria-labelledby="trust-heading">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="trust-heading" className="text-2xl font-semibold tracking-tight">
              You stay in control of who sees what
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {TRUST.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
                    <item.icon className="text-brand-300 size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500 sm:px-6">
        <p>
          HealthOS is an organization and coordination tool. It does not diagnose conditions,
          recommend treatment or replace your doctor. In an emergency, contact your local emergency
          number immediately.
        </p>
        <p className="mt-3">© {new Date().getFullYear()} HealthOS</p>
      </footer>
    </div>
  );
}
