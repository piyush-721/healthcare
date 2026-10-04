"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/ui";
import { useAppSelector } from "@/store/hooks";

/**
 * Client-side gate for signed-in areas. This only controls what is rendered;
 * every API call is independently authorized by the backend.
 */
export function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { status, user } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }
  if (requireAdmin && !user.is_platform_admin) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Administrator access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account doesn&apos;t have access to the admin console.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
