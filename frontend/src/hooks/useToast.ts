"use client";

import { useCallback } from "react";

import { getErrorMessage } from "@/lib/api/errors";
import { useAppDispatch } from "@/store/hooks";
import { toastAdded } from "@/store/slices/toastSlice";

export function useToast() {
  const dispatch = useAppDispatch();
  const success = useCallback(
    (message: string) => dispatch(toastAdded(message, "success")),
    [dispatch],
  );
  const info = useCallback((message: string) => dispatch(toastAdded(message, "info")), [dispatch]);
  const error = useCallback(
    (err: unknown, fallback?: string) =>
      dispatch(toastAdded(typeof err === "string" ? err : getErrorMessage(err, fallback), "error")),
    [dispatch],
  );
  return { success, info, error };
}
