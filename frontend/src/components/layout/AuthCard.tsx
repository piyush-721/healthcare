import type { ReactNode } from "react";

import { Card } from "@/components/ui";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-slate-600">{description}</p>}
      <div className="mt-6">{children}</div>
      {footer && (
        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
          {footer}
        </div>
      )}
    </Card>
  );
}
