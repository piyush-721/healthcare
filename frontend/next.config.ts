import type { NextConfig } from "next";

/**
 * The browser only ever talks to the Next.js origin. `/api/v1/*` is proxied to
 * Django, so the HttpOnly refresh cookie and CSRF cookie are first-party and
 * no CORS is needed in the browser.
 */
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Django routes end with "/"; keep them intact when proxying.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    // `:path*` drops the trailing slash Django expects, so it is re-appended.
    return [{ source: "/api/v1/:path*", destination: `${backendOrigin}/api/v1/:path*/` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
