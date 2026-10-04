"use client";

import { useEffect, useState } from "react";

/**
 * Read `#token=…` from the URL fragment, then strip it from the address bar.
 * Fragments are never sent to servers, so secrets in emailed links stay out of
 * access logs and Referer headers.
 */
export function useUrlToken(): { token: string | null; ready: boolean } {
  const [state, setState] = useState<{ token: string | null; ready: boolean }>({
    token: null,
    ready: false,
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    if (token)
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    // The effect can run twice (React StrictMode); keep a token captured by the first run,
    // since that run already removed it from the address bar.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state
    setState((prev) => ({ token: token ?? prev.token, ready: true }));
  }, []);
  return state;
}
