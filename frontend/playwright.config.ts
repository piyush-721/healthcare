import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a live stack (frontend :3000, backend :8000, Mailpit :8025):
 *   make services && make backend && make worker && make frontend
 *   npm run test:e2e
 * Set E2E_BROWSER_CHANNEL=chrome to use a locally installed Chrome instead of Playwright's Chromium.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: process.env.E2E_BROWSER_CHANNEL || undefined },
      grep: /@mobile/,
    },
  ],
});
