"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/cn";
import { humanize, initials } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import { activeProfileChanged } from "@/store/slices/profileSlice";

function Avatar({ name, self }: { name: string; self?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
        self ? "bg-brand-100 text-brand-800" : "bg-slate-200 text-slate-700",
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Choose whose health information to view: yourself, a dependent, or someone you care for. */
export function ProfileSwitcher({ compact = false }: { compact?: boolean }) {
  const { profile, profiles } = useActiveProfile();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profile) return null;
  const label = (p: typeof profile) =>
    p.is_self
      ? "You"
      : p.access_role === "OWNER"
        ? humanize(p.relationship_to_owner)
        : "Shared with you";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Viewing health information for ${profile.full_name}. Change profile`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white text-left shadow-sm hover:bg-slate-50",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        )}
      >
        <Avatar name={profile.full_name} self={profile.is_self} />
        <span className={cn("min-w-0 flex-1", compact && "max-sm:hidden")}>
          <span className="block truncate text-sm font-medium text-slate-900">
            {profile.full_name}
          </span>
          {!compact && (
            <span className="block truncate text-xs text-slate-500">{label(profile)}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Profiles"
          className="absolute z-40 mt-1 max-h-80 w-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg max-sm:right-0"
        >
          {profiles.map((p) => {
            const selected = p.id === profile.id;
            return (
              <li key={p.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    dispatch(activeProfileChanged(p.is_self ? null : p.id));
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50"
                >
                  <Avatar name={p.full_name} self={p.is_self} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.full_name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {label(p)}
                      {p.access_role === "CAREGIVER" && ` · managed by ${p.owner_name}`}
                    </span>
                  </span>
                  {selected && <Check className="text-brand-700 size-4" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
