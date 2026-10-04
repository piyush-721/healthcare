export const MIN_PASSWORD_LENGTH = 10;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return undefined;
}

/** Client-side hints only — the server enforces the real password policy. */
export function validateNewPassword(password: string, confirm?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (/^\d+$/.test(password)) {
    errors.password = "Your password can't be entirely numeric.";
  }
  if (confirm !== undefined && confirm !== password) errors.confirm = "Passwords don't match.";
  return errors;
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return "/dashboard";
  return next;
}
