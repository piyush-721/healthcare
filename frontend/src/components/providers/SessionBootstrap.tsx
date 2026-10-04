"use client";

import { useEffect, useRef } from "react";

import { api, refreshAccessToken } from "@/lib/api/baseApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { sessionEstablished, signedOut } from "@/store/slices/authSlice";

const REFRESH_MARGIN_MS = 60_000;

/**
 * Restores the session on page load from the HttpOnly refresh cookie and
 * refreshes the in-memory access token shortly before it expires.
 */
export function SessionBootstrap() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const expiresAt = useAppSelector((state) => state.auth.accessTokenExpiresAt);
  const started = useRef(false);

  useEffect(() => {
    if (status !== "unknown" || started.current) return;
    started.current = true;
    void refreshAccessToken().then((result) => {
      dispatch(result ? sessionEstablished(result) : signedOut());
    });
  }, [status, dispatch]);

  useEffect(() => {
    if (status !== "authenticated" || !expiresAt) return;
    const delay = Math.max(new Date(expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS, 5_000);
    const timer = setTimeout(async () => {
      const result = await refreshAccessToken();
      dispatch(result ? sessionEstablished(result) : signedOut());
    }, delay);
    return () => clearTimeout(timer);
  }, [status, expiresAt, dispatch]);

  // Drop cached health data on sign-out. Only on a real authenticated → anonymous
  // transition: resetting also aborts in-flight requests, which would break public
  // pages (verify email, shared links) for visitors who were never signed in.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current === "authenticated" && status === "anonymous") {
      dispatch(api.util.resetApiState());
    }
    previousStatus.current = status;
  }, [status, dispatch]);

  return null;
}
