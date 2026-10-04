"use client";

import { LogOut, Shield, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/hooks/useToast";
import { initials } from "@/lib/format";
import { useLogoutMutation } from "@/services/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { signedOut } from "@/store/slices/authSlice";

export function useSignOut() {
  const [logout, { isLoading }] = useLogoutMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const signOut = async () => {
    try {
      await logout().unwrap();
    } catch {
      /* Session already invalid server-side — clear local state regardless. */
    }
    dispatch(signedOut());
    router.replace("/login");
    toast.info("You've been signed out.");
  };
  return { signOut, isLoading };
}

export function UserMenu() {
  const user = useAppSelector((state) => state.auth.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useSignOut();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700"
        aria-label="Account menu"
      >
        {initials(user.full_name)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-50"
          >
            <UserIcon className="size-4 text-slate-500" aria-hidden /> Account
          </Link>
          <Link
            role="menuitem"
            href="/settings/security"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Shield className="size-4 text-slate-500" aria-hidden /> Security
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
