import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-slate-200 bg-white shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-slate-900">{title}</Heading>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}

/** Definition-list style key/value rows used on detail pages. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd className="text-sm text-slate-900 sm:col-span-2">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
