/** Double-submit CSRF support for the cookie-based auth endpoints. */

const CSRF_COOKIE = "csrftoken";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export async function getCsrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  const response = await fetch("/api/v1/auth/csrf/", { credentials: "same-origin" });
  const body: unknown = await response.json();
  if (
    body &&
    typeof body === "object" &&
    "csrf_token" in body &&
    typeof body.csrf_token === "string"
  ) {
    return body.csrf_token;
  }
  throw new Error("Unable to obtain CSRF token.");
}
