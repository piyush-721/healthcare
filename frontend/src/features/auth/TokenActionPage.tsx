"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AuthCard } from "@/components/layout/AuthCard";
import { LoadingState } from "@/components/ui";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getErrorMessage } from "@/lib/api/errors";

type Outcome = { ok: true; message: string } | { ok: false; message: string };

/** Shared flow for "click the link in your email" pages that act immediately. */
export function TokenActionPage({
  title,
  action,
  successCta,
  failure,
}: {
  title: string;
  action: (token: string) => Promise<{ detail: string }>;
  successCta: { href: string; label: string };
  failure: React.ReactNode;
}) {
  const { token, ready } = useUrlToken();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from browser-only URL fragment
      setOutcome({ ok: false, message: "This link is missing its token." });
      return;
    }
    action(token)
      .then((result) => setOutcome({ ok: true, message: result.detail }))
      .catch((err: unknown) => setOutcome({ ok: false, message: getErrorMessage(err) }));
  }, [ready, token, action]);

  return (
    <AuthCard title={title}>
      {!outcome ? (
        <LoadingState label="Checking your link…" />
      ) : (
        <div
          className="flex flex-col items-center text-center"
          role={outcome.ok ? "status" : "alert"}
        >
          {outcome.ok ? (
            <CheckCircle2 className="mb-3 size-10 text-emerald-600" aria-hidden />
          ) : (
            <XCircle className="mb-3 size-10 text-red-600" aria-hidden />
          )}
          <p className="text-sm text-slate-700">{outcome.message}</p>
          <div className="mt-6 w-full">
            {outcome.ok ? (
              <Link
                href={successCta.href}
                className="text-brand-700 text-sm font-medium hover:underline"
              >
                {successCta.label}
              </Link>
            ) : (
              failure
            )}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
