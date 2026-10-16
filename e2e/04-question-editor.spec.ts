import { config as loadEnv } from "dotenv";
import { expect, test, type Page } from "@playwright/test";

import { clearRateLimits } from "./clear-rate-limits";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * The question editor's promise, tested end to end: an edit reaches candidates who come after it,
 * and changes nothing for candidates already mid-flight or filed. Every save is copy-forward, so
 * the spec finishes by reverting its own edit — the bank keeps its wording, at a higher version.
 */
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const run = Date.now();
const emailPinned = `qa.editor.pinned+${run}@example.com`;
const emailFresh = `qa.editor.fresh+${run}@example.com`;
const suffix = ` [QA-EDIT ${run}]`;

const EDITED_KEY = "q01";

test.beforeAll(async () => {
  // The specs before this one consume most of the session-start budget (5 / 600s) between them;
  // this spec resets the ephemeral buckets so its two registrations get a clean window.
  await clearRateLimits();
});

test.describe("admin question editor", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "ADMIN_EMAIL and ADMIN_PASSWORD must be set to run this spec.",
  );

  test("an edit reaches new candidates while pinned assessments keep their wording", async ({
    page,
    browser,
  }) => {
    // --- A candidate starts before the edit ---------------------------------
    await page.goto("/");
    await page.getByLabel("Name").fill("QA Pinned");
    await page.getByLabel("Email").fill(emailPinned);
    await page.getByRole("button", { name: /begin the assessment/i }).click();
    await expect(page).toHaveURL(/\/assessment\?move=1$/);

    const pinned = await findQuestion(page, EDITED_KEY);
    expect(pinned.prompt).not.toContain("QA-EDIT");

    // --- The hiring team edits the wording ----------------------------------
    await signIn(page, adminEmail!, adminPassword!);
    await page.getByRole("link", { name: "Questions" }).click();
    await expect(page).toHaveURL(/\/admin\/questions$/);
    await expect(page.getByRole("heading", { name: "Question bank" })).toBeVisible();

    const versionBefore = await readPublishedVersion(page);

    const block = editorBlock(page, EDITED_KEY);
    await block.locator(`#${EDITED_KEY}-prompt`).fill(pinned.prompt + suffix);

    // The save is a full round-trip: the version the server reports back is the confirmation.
    await block.getByRole("button", { name: /save as new version/i }).click();
    await expect(block.getByRole("status")).toContainText(
      new RegExp(`Published as version ${versionBefore + 1}\\b`),
    );
    await expect(publishedVersionLine(page)).toContainText(
      new RegExp(`version ${versionBefore + 1}\\b`),
    );

    // --- The in-flight candidate reloads: unchanged wording -----------------
    await page.goto(`/assessment?move=${pinned.move}`);
    await expect(page.locator(`#${EDITED_KEY}`)).toHaveText(pinned.prompt);

    // --- A new candidate starts after the edit ------------------------------
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    try {
      await freshPage.goto("/");
      await freshPage.getByLabel("Name").fill("QA Fresh");
      await freshPage.getByLabel("Email").fill(emailFresh);
      await freshPage.getByRole("button", { name: /begin the assessment/i }).click();
      await expect(freshPage).toHaveURL(/\/assessment\?move=1$/);

      const fresh = await findQuestion(freshPage, EDITED_KEY);
      expect(fresh.prompt).toBe(pinned.prompt + suffix);

      // --- The edit is reverted; the bank returns to its own wording ---------
      await page.goto("/admin/questions");
      const revertBlock = editorBlock(page, EDITED_KEY);
      await revertBlock.locator(`#${EDITED_KEY}-prompt`).fill(pinned.prompt);
      await revertBlock.getByRole("button", { name: /save as new version/i }).click();
      await expect(revertBlock.getByRole("status")).toContainText(
        new RegExp(`Published as version ${versionBefore + 2}\\b`),
      );

      // The reverted version is the newest, but neither candidate moves: A stays on the wording they
      // began with, and B stays on the one edit that existed when they registered.
      await expect(publishedVersionLine(page)).toContainText(
        new RegExp(`version ${versionBefore + 2}\\b`),
      );

      await freshPage.goto(`/assessment?move=${fresh.move}`);
      await expect(freshPage.locator(`#${EDITED_KEY}`)).toHaveText(pinned.prompt + suffix);

      await page.goto(`/assessment?move=${pinned.move}`);
      await expect(page.locator(`#${EDITED_KEY}`)).toHaveText(pinned.prompt);
    } finally {
      await freshContext.close();
    }
  });
});

/**
 * The move a candidate is shown a given question on is part of their persisted shuffle, so the test
 * walks the moves until the question's heading appears and remembers where it was.
 */
async function findQuestion(page: Page, questionKey: string) {
  for (let move = 1; move <= 20; move += 1) {
    await page.goto(`/assessment?move=${move}`);
    const heading = page.locator(`#${questionKey}`);
    if ((await heading.count()) > 0) {
      return { move, prompt: (await heading.innerText()).trim() };
    }
  }
  throw new Error(`Question ${questionKey} was not found on any of the first 20 moves.`);
}

function editorBlock(page: Page, questionKey: string) {
  return page.locator("form", { has: page.locator(`#${questionKey}-prompt`) });
}

function publishedVersionLine(page: Page) {
  return page.locator("main p").filter({ hasText: /Currently published as version \d+/ });
}

async function readPublishedVersion(page: Page): Promise<number> {
  const line = await publishedVersionLine(page).innerText();
  const match = line.match(/version (\d+)/);
  if (!match) throw new Error(`Could not read the published version from "${line}".`);
  return Number.parseInt(match[1]!, 10);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
