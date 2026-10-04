import Link from "next/link";

import { cn } from "@/lib/cn";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold text-slate-900", className)}
    >
      <span
        className="bg-brand-700 grid size-8 place-items-center rounded-lg text-white"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="text-lg tracking-tight">
        Health<span className="text-brand-700">OS</span>
      </span>
    </Link>
  );
}
