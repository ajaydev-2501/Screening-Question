import { config as loadEnv } from "dotenv";
import { expect, test } from "@playwright/test";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * The hiring team's side, from the outside in: it must be unreachable without credentials, the
 * credentials in the environment must work, and a signed-in session must be able to read a record
 * and export it.
 *
 * This spec reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment rather than hard-coding them,
 * so it tests the same door the recruiter uses and the secret never appears in the repository.
 */
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.describe("admin access", () => {
  test.skip(!email || !password, "ADMIN_EMAIL and ADMIN_PASSWORD must be set to run this spec.");

  test("records are unreachable without a session", async ({ page, request }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    const exported = await request.get("/api/admin/export", { maxRedirects: 0 });
    expect([302, 307]).toContain(exported.status());
    expect(exported.headers()["location"] ?? "").toContain("/admin/login");
  });

  test("a wrong password is refused without saying why", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(`${password}-wrong`);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.locator("form [role=alert]")).toContainText(
      "Those credentials do not match an administrator account.",
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("the records page does not pan sideways on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Candidate records" })).toBeVisible();

    // The document itself must never scroll horizontally at phone width. Visually-clipped
    // absolute helpers (sr-only) must not extend the page's scroll area.
    const documentOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(documentOverflow).toBeLessThanOrEqual(0);

    // …while the wide records table still scrolls inside its own wrapper.
    const wrapperScrolls = await page.evaluate(() => {
      const table = document.querySelector("main table");
      const wrapper = table?.parentElement;
      if (!wrapper) return null;
      return wrapper.scrollWidth > wrapper.clientWidth;
    });
    expect(wrapperScrolls).toBe(true);
  });

  test("a signed-in session reads a record and exports the list", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Candidate records" })).toBeVisible();

    // The candidate journey runs first and files a record, so the newest row is always readable.
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    const candidateEmail = await firstRow.locator("td span").first().innerText();
    expect(candidateEmail).toContain("@");

    const exported = await page.request.get("/api/admin/export");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-type"]).toContain("text/csv");

    const csv = await exported.text();
    expect(csv).toContain('"candidate","email","status"');
    expect(csv).toContain('"section_ai-agents"');
    expect(csv).toContain(candidateEmail);

    // Reset ends the candidate session in this browser and lands on the entry screen, while the
    // admin session stays signed in.
    await page.getByRole("button", { name: /^reset$/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /begin the assessment/i })).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Candidate records" })).toBeVisible();
    const reopenedRow = page.locator("tbody tr").first();
    await expect(reopenedRow).toBeVisible();

    await reopenedRow.getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/admin\/candidates\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Total score")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tool inventory" })).toBeVisible();

    // Nothing on the admin side is a candidate's business: the record page is noindex and the
    // session ends on sign-out.
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
