/**
 * Capture round for the finish review.
 *
 * Walks the candidate journey and the admin screens against a running app and writes full-page
 * screenshots into `.impeccable/review/`, one file per screen per viewport. The created record is
 * marked `qa.capture+...` so it can be recognised and removed as test data.
 *
 * Every wait is bounded and the run has a watchdog: an unattended capture must fail loudly, never
 * hang. Pages too tall for a single bitmap are captured as scrolled viewport tiles instead.
 *
 * Run with the dev server (or a preview build) up: `npx tsx scripts/capture-review.ts`.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(".impeccable/review");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const ACTION_TIMEOUT = 20_000;
const SHOT_TIMEOUT = 15_000;
const WATCHDOG_MS = 280_000;
/** Above this height a single full-page bitmap is where headless Chromium gets unhappy; tile it. */
const FULL_PAGE_MAX = 12_000;

const watchdog = setTimeout(() => {
  console.error(`capture exceeded ${WATCHDOG_MS / 1000}s — aborting so it cannot hang unattended`);
  process.exit(1);
}, WATCHDOG_MS);

function watch(page: Page, label: string): void {
  page.on("pageerror", (error) => console.error(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[${label}] console.error: ${message.text()}`);
  });
}

async function context(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<{ context: BrowserContext; page: Page }> {
  const created = await browser.newContext({ viewport, reducedMotion: "reduce" });
  created.setDefaultTimeout(ACTION_TIMEOUT);
  const page = await created.newPage();
  return { context: created, page };
}

async function shot(page: Page, name: string): Promise<void> {
  // Bounded liveness probe: if the renderer is stuck, fail here with a clear message instead of
  // letting the screenshot wait forever.
  await page.waitForFunction(() => document.readyState === "complete", undefined, {
    timeout: 5_000,
  });
  await page.waitForTimeout(350);

  const height = await page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
  );

  if (height <= FULL_PAGE_MAX) {
    try {
      await page.screenshot({
        path: path.join(OUT, `${name}.png`),
        fullPage: true,
        animations: "disabled",
        timeout: SHOT_TIMEOUT,
      });
      console.log(`captured ${name}.png (full page, ${height}px)`);
      return;
    } catch (error) {
      console.warn(`${name}: full-page shot failed at ${height}px — ${String(error)}`);
    }
  } else {
    console.warn(`${name}: ${height}px tall, capturing scrolled tiles instead of one bitmap`);
  }

  const viewport = page.viewportSize() ?? DESKTOP;
  const count = Math.min(5, Math.max(2, Math.ceil(height / (viewport.height * 0.9))));
  for (let index = 0; index < count; index += 1) {
    const top = Math.max(0, Math.round(((height - viewport.height) * index) / (count - 1)));
    await page.evaluate((value) => window.scrollTo(0, value), top);
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT, `${name}-${index + 1}.png`),
      animations: "disabled",
      timeout: SHOT_TIMEOUT,
    });
    console.log(`captured ${name}-${index + 1}.png (tile ${index + 1}/${count}, top ${top}px)`);
  }
}

/** The id of the visible question heading — the shuffled question key, e.g. `q13`. */
async function currentQuestionKey(page: Page): Promise<string> {
  return (await page.locator("main h2").first().getAttribute("id")) ?? "";
}

/** Resolves once the footer's Next link is no longer blocked by a pending write. */
function nextLinkReady(page: Page): Promise<void> {
  return page.waitForFunction(
    () => {
      const link = Array.from(document.querySelectorAll("footer a")).find((candidate) =>
        /next move/i.test(candidate.textContent ?? ""),
      );
      return link !== undefined && !link.hasAttribute("aria-disabled");
    },
    undefined,
    { timeout: ACTION_TIMEOUT },
  ).then(() => undefined);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  try {
    const candidate = await context(browser, DESKTOP);
    const page = candidate.page;
    watch(page, "candidate");

    // --- Landing -------------------------------------------------------------
    console.log("--- landing ---");
    await page.goto(BASE);
    await shot(page, "desktop");
    await page.setViewportSize(MOBILE);
    await shot(page, "mobile");
    await page.setViewportSize(DESKTOP);

    // --- The sheet, moves 1-20 ----------------------------------------------
    console.log("--- moves 1-20 ---");
    await page.getByLabel("Name").fill("Mara Okonkwo");
    await page.getByLabel("Email").fill(`qa.capture+${Date.now()}@example.com`);
    await page.getByRole("button", { name: /begin the assessment/i }).click();
    await page.waitForURL(/\/assessment\?move=1$/);
    // The question order is shuffled per candidate, so move 1's question key is unknown; the
    // radiogroup only exists on a question screen, which makes it the reliable arrival anchor.
    await page.locator('main [role="radiogroup"]').first().waitFor({ state: "visible" });

    await shot(page, "question");
    await page.setViewportSize(MOBILE);
    await shot(page, "question-mobile");
    await page.setViewportSize(DESKTOP);

    for (let move = 1; move <= 20; move += 1) {
      const previousKey = await currentQuestionKey(page);
      const options = page.locator('main [role="radiogroup"] > label');
      const written = page.waitForResponse(
        (response) =>
          response.url().includes("/api/assessment/answer") && response.status() === 200,
        { timeout: ACTION_TIMEOUT },
      );
      await options.nth((move + 1) % 4).click();
      await written;
      // The shell disables the Next link until the write has landed; clicking it earlier is a
      // no-op, so wait for the footer actually to be in its ready state.
      await nextLinkReady(page);
      await page.getByRole("link", { name: /next move/i }).click();
      // Soft navigation: the URL can change before the previous move's DOM is replaced, so an
      // unsynced click would land on the old page. Wait for the sheet to swap to the next move —
      // the heading id is the question key, which changes on every move.
      await page.waitForURL(new RegExp(`/assessment\\?move=${move + 1}$`));
      await page.waitForFunction(
        (previous) => {
          const heading = document.querySelector("main h2");
          return heading !== null && heading.id !== previous;
        },
        previousKey,
        { timeout: ACTION_TIMEOUT },
      );
    }
    await page.locator("#q21").waitFor({ state: "visible" });

    // --- Move 21: the inventory ----------------------------------------------
    console.log("--- move 21: inventory ---");
    const catalog = page.locator('section[aria-labelledby="inventory-tools"]');
    const search = page.getByLabel("Search the tool catalog");
    for (const name of [
      "Playwright",
      "Vitest",
      "PostgreSQL",
      "Docker",
      "Claude Code",
      "Visual Studio Code (VS Code)",
    ]) {
      await search.fill(name);
      await catalog
        .locator("label", {
          hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        })
        .click();
    }
    await search.fill("");

    const followups = page.locator('section[aria-labelledby="inventory-followups"]');
    const ranking = followups.locator("select");
    await ranking.nth(0).selectOption({ label: "Claude Code" });
    await ranking.nth(1).selectOption({ label: "Playwright" });
    await ranking.nth(2).selectOption({ label: "PostgreSQL" });

    await followups.locator('[role="radiogroup"]').nth(0).getByText("Claude Code", { exact: true }).click();
    // The depth options are full sentences ("For a structured workflow including planning,
    // bounded agent execution, testing, …"), so this one is matched as a substring of the label.
    await followups
      .locator('[role="radiogroup"]')
      .nth(1)
      .locator("label", { hasText: "bounded agent execution" })
      .click();

    const inventoryWritten = page.waitForResponse(
      (response) =>
        response.url().includes("/api/assessment/inventory") && response.status() === 200,
      { timeout: ACTION_TIMEOUT },
    );
    await page
      .getByPlaceholder(/^The task was/)
      .fill(
        "The task was to make a webhook handler idempotent under retries. I planned it by listing the " +
          "failure modes first, then had the agent draft the transaction boundary. I wrote tests that " +
          "deliver the same event twice, and verified the result by replaying it in staging.",
      );
    await inventoryWritten;

    await shot(page, "inventory");
    await page.setViewportSize(MOBILE);
    await shot(page, "inventory-mobile");
    await page.setViewportSize(DESKTOP);

    // --- Review and file ------------------------------------------------------
    console.log("--- review and file ---");
    await page.getByRole("link", { name: /review & submit/i }).click();
    await page.waitForURL(/\/assessment\/confirm$/);
    await shot(page, "confirm");

    const filed = page.waitForResponse(
      (response) =>
        response.url().includes("/api/assessment/submit") && response.status() === 200,
      { timeout: ACTION_TIMEOUT },
    );
    await page.getByRole("button", { name: /submit this record/i }).click();
    await filed;
    await page.waitForURL(/\/assessment\/submitted$/);
    await shot(page, "submitted");

    // --- Admin ---------------------------------------------------------------
    console.log("--- admin ---");
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local to capture admin.");
    }

    const admin_ = await context(browser, DESKTOP);
    const admin = admin_.page;
    watch(admin, "admin");
    await admin.goto(`${BASE}/admin/login`);
    await shot(admin, "admin-login");

    await admin.getByLabel("Email").fill(adminEmail);
    await admin.getByLabel("Password").fill(adminPassword);
    await admin.getByRole("button", { name: /sign in/i }).click();
    await admin.waitForURL(/\/admin$/);
    await shot(admin, "admin-dashboard");
    await admin.setViewportSize(MOBILE);
    await shot(admin, "admin-dashboard-mobile");
    await admin.setViewportSize(DESKTOP);

    await admin.locator("tbody tr").first().getByRole("link", { name: "Open" }).click();
    await admin.waitForURL(/\/admin\/candidates\/[0-9a-f-]{36}$/);
    await shot(admin, "admin-record");
  } catch (error) {
    // Best-effort evidence for whichever wait failed: the page it was looking at, in words and
    // pixels, so the next run can be fixed without re-deriving the state from logs.
    try {
      const pages = browser.contexts().flatMap((created) => created.pages());
      const active = pages[pages.length - 1];
      if (active) {
        console.error(`capture failed on ${active.url()}`);
        console.error((await active.evaluate(() => document.body.innerText)).slice(0, 500));
        await active.screenshot({
          path: path.join(OUT, "debug-failure.png"),
          timeout: 10_000,
        });
      }
    } catch {
      // Diagnostics are best-effort; the original error is what matters.
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main()
  .then(() => {
    clearTimeout(watchdog);
    console.log("capture round complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(watchdog);
    process.exit(1);
  });
