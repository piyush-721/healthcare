"use client";

import { LinkButton } from "@/components/ui";
import { useAppSelector } from "@/store/hooks";

export function HeaderActions() {
  const status = useAppSelector((state) => state.auth.status);
  if (status === "authenticated") {
    return <LinkButton href="/dashboard">Open dashboard</LinkButton>;
  }
  return (
    <div className="flex items-center gap-2">
      <LinkButton href="/login" variant="ghost">
        Sign in
      </LinkButton>
      <LinkButton href="/signup">Get started</LinkButton>
    </div>
  );
}
