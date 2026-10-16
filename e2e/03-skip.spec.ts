import { expect, test } from "@playwright/test";

/**
 * Skipping is a recorded decision, not an escape hatch: every skipped move is written to the
 * sheet, scores nothing, and the record can still be filed — including when the candidate skipped
 * every move there is. And because skip is a decision, it is also reversible: answering a skipped
 * move must erase the skip, exactly as re-selecting must.
 *
 * Each run registers a fresh address; the prefix marks these rows as test data.
 */
const email = `qa.skip+${Date.now()}@example.com`;
const emailSecond = `qa.skip.again+${Date.now()}@example.com`;

test("a candidate can skip every move and still file a whole record", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("QA Skipper");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /begin the assessment/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=1$/);

  // --- Moves 1-20: every one declined ----------------------------------------
  // One move is skipped from the keyboard to prove the S path; the rest via the footer control.
  // In every case the write must land before the shell advances — skip is persisted, never a
  // client-side "let me through".
  for (let move = 1; move <= 20; move += 1) {
    const written = page.waitForResponse(
      (response) =>
        response.url().includes("/api/assessment/answer") && response.status() === 200,
    );
    if (move === 3) {
      await page.keyboard.press("s");
    } else {
      await page.getByRole("button", { name: /^skip/i }).click();
    }
    await written;
    await expect(page).toHaveURL(new RegExp(`/assessment\\?move=${move + 1}$`));
  }

  // A skipped move leaves a struck, hollow mark — the rail must not call it answered.
  await expect(page.getByText("Move 3: skipped").first()).toBeAttached();

  // --- Move 21: the inventory is declined too --------------------------------
  await expect(page).toHaveURL(/\/assessment\?move=21$/);

  const inventorySkipped = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/inventory") && response.status() === 200,
  );
  await page.getByRole("button", { name: /^skip/i }).click();
  await inventorySkipped;

  // --- Review: skips read as decisions, nothing is outstanding ---------------
  await expect(page).toHaveURL(/\/assessment\/confirm$/);
  await expect(page.locator("main ol > li")).toHaveCount(21);
  await expect(page.getByText("Skipped.", { exact: true })).toHaveCount(20);
  await expect(page.getByText(/the follow-up questions were declined/)).toHaveCount(1);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);

  // --- File: a fully-skipped sheet is still a whole record -------------------
  const filed = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/submit") && response.status() === 200,
  );
  await page.getByRole("button", { name: /submit this record/i }).click();
  await filed;

  await expect(page).toHaveURL(/\/assessment\/submitted$/);
  await expect(page.getByText("FILED", { exact: true })).toBeVisible();
  // Every move was decided — declined counts as decided; none was left open.
  await expect(page.getByText("20 of 20 recorded")).toBeVisible();
});

test("a skipped move can be answered afterwards, and the skip is gone", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("QA Reconsider");
  await page.getByLabel("Email").fill(emailSecond);
  await page.getByRole("button", { name: /begin the assessment/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=1$/);

  // Decline move 1, then walk back to it.
  let written = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/answer") && response.status() === 200,
  );
  await page.getByRole("button", { name: /^skip/i }).click();
  await written;
  await expect(page).toHaveURL(/\/assessment\?move=2$/);

  await page.getByRole("link", { name: /^back$/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=1$/);
  // The skipped move reads back with nothing selected — the decline is stored, not the option.
  await expect(page.locator('main [role="radiogroup"] input:checked')).toHaveCount(0);

  // Answer it: engagement replaces the skip.
  written = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/answer") && response.status() === 200,
  );
  await page.locator('main [role="radiogroup"] > label').first().click();
  await written;
  await page.getByRole("link", { name: /next move/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=2$/);
  await expect(page.getByText("Move 1: answered").first()).toBeAttached();

  // Reload so the rail is rebuilt from the server, not from local state.
  await page.reload();
  await expect(page.getByText("Move 1: answered").first()).toBeAttached();

  // Skip it again: the chosen option must be discarded, and the skip must survive a reload.
  await page.getByRole("link", { name: /^back$/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=1$/);
  written = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/answer") && response.status() === 200,
  );
  await page.getByRole("button", { name: /^skip/i }).click();
  await written;
  await expect(page).toHaveURL(/\/assessment\?move=2$/);

  await page.reload();
  await expect(page.getByText("Move 1: skipped").first()).toBeAttached();

  await page.getByRole("link", { name: /^back$/i }).click();
  await expect(page).toHaveURL(/\/assessment\?move=1$/);
  await expect(page.locator('main [role="radiogroup"] input:checked')).toHaveCount(0);
});
