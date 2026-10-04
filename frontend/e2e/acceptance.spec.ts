import { expect, test, type Page } from "@playwright/test";

/**
 * The build plan's acceptance journey (§46), driven through the real UI:
 * signup → verify email → login → profile → family → medication → appointment →
 * document → lab results → treatment plan → timeline → share → provider access →
 * revoke → access denied → notifications → security activity → logout.
 *
 * Requires the full stack plus Mailpit (http://localhost:8025) for the verification email.
 */

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "Acceptance-Flow-Pass-42";

async function latestEmailLink(page: Page, to: string, path: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await page.request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
        );
        const { messages } = (await list.json()) as { messages: { ID: string }[] };
        if (!messages.length) return false;
        const message = await page.request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
        const { Text } = (await message.json()) as { Text: string };
        link = Text.match(new RegExp(`https?://\\S+${path}#token=[\\w-]+`))?.[0];
        return Boolean(link);
      },
      { timeout: 30_000, message: `email with ${path} link for ${to}` },
    )
    .toBe(true);
  return link!;
}

test("new user completes the full HealthOS journey", async ({ page, browser, baseURL }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Create an account
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Esha Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByLabel(/does not provide medical advice/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

  // 2. Verify email via the emailed link (token travels in the URL fragment)
  const verifyLink = await latestEmailLink(page, email, "/verify-email");
  await page.goto(verifyLink.replace(/^https?:\/\/[^/]+/, baseURL ?? ""));
  await expect(page.getByText(/email address is verified/i)).toBeVisible();
  expect(page.url()).not.toContain("token=");

  // 3. Log in
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Esha/ })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(window.localStorage))).not.toMatch(/token/i);

  // 4. Complete the health profile
  await page.goto("/health-profile");
  await page.getByLabel("Date of birth").first().fill("1990-05-20");
  await page.getByLabel("Blood type").selectOption("O+");
  await page.getByRole("button", { name: /save/i }).first().click();
  await expect(page.getByText(/saved|updated/i).first()).toBeVisible();

  // 5. Add a family member
  await page.goto("/family");
  await page.getByRole("button", { name: "Add family member" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Kiaan Tester");
  await dialog.getByLabel("Relationship to you").selectOption("CHILD");
  await dialog.getByRole("button", { name: "Add family member" }).click();
  await expect(page.getByText("Kiaan Tester").first()).toBeVisible();

  // 6. Add a medication
  await page.goto("/medications");
  await page.getByRole("button", { name: "Add medication" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Medication name").fill("Metformin");
  await dialog.getByLabel("Dosage").fill("500 mg");
  await dialog.getByRole("button", { name: "Add medication" }).click();
  await expect(
    page.getByRole("heading", { name: "Metformin" }).or(page.getByText("Metformin")).first(),
  ).toBeVisible();

  // 7. Create an appointment
  await page.goto("/appointments");
  await page.getByRole("button", { name: "New appointment" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Follow-up consultation");
  const inTenDays = new Date(Date.now() + 10 * 864e5);
  inTenDays.setHours(10, 30, 0, 0);
  const local = new Date(inTenDays.getTime() - inTenDays.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await dialog.getByLabel("Date and time").fill(local);
  await dialog.getByRole("button", { name: "Add appointment" }).click();
  await expect(page.getByText("Follow-up consultation").first()).toBeVisible();

  // 8. Upload a medical document
  await page.goto("/records?tab=documents");
  await page.getByRole("button", { name: "Upload document" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("File").setInputFiles({
    name: "cbc-report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
  });
  await dialog.getByLabel("Document type").selectOption("LAB_REPORT");
  await dialog.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText(/cbc-report|cbc report/i).first()).toBeVisible();

  // 9. Add lab results
  await page.goto("/labs");
  await page.getByRole("button", { name: "Add lab report" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Complete blood count");
  await dialog.getByLabel("Test name").first().fill("Hemoglobin");
  await dialog
    .getByLabel(/^Value/)
    .first()
    .fill("13.2");
  await dialog.getByLabel("Unit").first().fill("g/dL");
  await dialog.getByRole("button", { name: "Add lab report" }).click();
  await expect(page.getByText("Complete blood count").first()).toBeVisible();

  // 10. Create a treatment plan
  await page.goto("/treatments");
  await page.getByRole("button", { name: "New treatment plan" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Post-consultation follow-up");
  await dialog.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByText("Post-consultation follow-up").first()).toBeVisible();

  // 11. View the unified timeline
  await page.goto("/timeline");
  for (const text of ["Follow-up consultation", "Complete blood count", "Started Metformin"]) {
    await expect(page.getByText(text).first()).toBeVisible();
  }

  // 12. Create a limited share
  await page.goto("/sharing");
  await page.getByRole("button", { name: /share/i }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Recipient name").fill("Dr. Sharma");
  await dialog.getByLabel("Medications").check();
  await dialog.getByRole("button", { name: "Create share link" }).click();
  const shareUrl = await dialog.getByLabel("Share link").inputValue();
  expect(shareUrl).toContain("/shared#token=");
  await dialog.getByRole("button", { name: "Done" }).click();

  // 13. Provider opens the link in a separate, signed-out browser
  const provider = await browser.newContext();
  const doctor = await provider.newPage();
  await doctor.goto(shareUrl.replace(/^https?:\/\/[^/]+/, baseURL ?? ""));
  await expect(doctor.getByText("Esha Tester").first()).toBeVisible();
  await doctor.getByRole("tab", { name: /medications/i }).click();
  await expect(doctor.getByText("Metformin").first()).toBeVisible();

  // 14. Revoke the share
  await page.goto("/sharing");
  await page
    .getByRole("link", { name: /Dr\. Sharma/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /revoke/i })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /revoke/i })
    .click();
  await expect(page.getByText(/revoked/i).first()).toBeVisible();

  // 15. Revoked access is denied (the provider opens the link again in a fresh tab)
  const again = await provider.newPage();
  await again.goto(shareUrl.replace(/^https?:\/\/[^/]+/, baseURL ?? ""));
  await expect(again.getByText(/revoked/i).first()).toBeVisible();
  await expect(again.getByText("Metformin")).toHaveCount(0);
  await provider.close();

  // 16. Notifications page works (security notices etc.)
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

  // 17. Review security activity
  await page.goto("/settings/security");
  await expect(page.getByText(/login|signed in/i).first()).toBeVisible();

  // 18. Log out securely
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("mobile navigation works @mobile", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@healthos.local");
  await page.getByLabel("Password").fill("Demo-Password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: "Meds" }).click();
  await expect(page).toHaveURL(/\/medications/);
  await page.getByRole("button", { name: "More" }).click();
  await page
    .getByRole("dialog", { name: "Navigation menu" })
    .getByRole("link", { name: "Timeline" })
    .click();
  await expect(page).toHaveURL(/\/timeline/);
});
