import { expect, test } from "@playwright/test";

/**
 * The journey that must never break: a candidate begins, answers all twenty-one moves, files the
 * record, and cannot start again — from this browser or from any other.
 *
 * Each run registers a fresh address because the instrument allows one attempt per candidate; the
 * prefix marks these rows so they can be recognised (and removed) as test data.
 */
const email = `qa.e2e+${Date.now()}@example.com`;

test("a candidate answers every move, files the record, and cannot begin twice", async ({
  page,
  browser,
}) => {
  // --- Entry -----------------------------------------------------------------
  await page.goto("/");
  await page.getByLabel("Name").fill("QA Journey");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /begin the assessment/i }).click();

  await expect(page).toHaveURL(/\/assessment\?move=1$/);
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

  // --- Moves 1-20 ------------------------------------------------------------
  // Every move is answered from the keyboard-free path a real candidate uses: click an option,
  // wait for the write to land, then advance. The rail mark lags the request, so the request is
  // what this waits on.
  for (let move = 1; move <= 20; move += 1) {
    const options = page.locator('main [role="radiogroup"] > label');
    await expect(options).toHaveCount(4);

    const written = page.waitForResponse(
      (response) =>
        response.url().includes("/api/assessment/answer") && response.status() === 200,
    );
    await options.nth(move % 4).click();
    await written;

    await expect(page.locator('[role="status"] span').first()).toHaveClass(/bg-certified/);
    await page.getByRole("link", { name: /next move/i }).click();
    await expect(page).toHaveURL(new RegExp(`/assessment\\?move=${move + 1}$`));
  }

  // --- Move 21: the inventory ------------------------------------------------
  await expect(page).toHaveURL(/\/assessment\?move=21$/);

  const catalog = page.locator('section[aria-labelledby="inventory-tools"]');
  const search = page.getByLabel("Search the tool catalog");

  await search.fill("playwright");
  await catalog.locator("label", { hasText: /^Playwright$/ }).click();
  await search.fill("vitest");
  await catalog.locator("label", { hasText: /^Vitest$/ }).click();
  await search.fill("");

  await expect(page.getByText("2 SELECTED")).toBeVisible();

  const followups = page.locator('section[aria-labelledby="inventory-followups"]');
  const ranking = followups.locator("select");
  await expect(ranking).toHaveCount(3);
  await ranking.nth(0).selectOption({ label: "Playwright" });
  await ranking.nth(1).selectOption({ label: "Vitest" });

  await followups.getByText("Claude Code", { exact: true }).click();
  await followups.getByText("bounded agent execution").click();

  const example = page.getByPlaceholder(/^The task was/);
  const inventoryWritten = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/inventory") && response.status() === 200,
  );
  await example.fill(
    "The task was to make a webhook handler idempotent under retries. I planned it by listing the " +
      "failure modes first, then had the agent draft the transaction boundary. I wrote tests that " +
      "deliver the same event twice, and verified the result by replaying it in staging.",
  );
  await inventoryWritten;

  // The autosave API refuses anything it cannot recognise, and the refusal costs the candidate
  // nothing: the invalid write is rejected without touching the stored inventory.
  const forged = await page.request.post("/api/assessment/inventory", {
    data: {
      selections: [{ toolKey: "not-a-real-tool" }],
      productivityTools: [],
      primaryAgentKey: "claude-code",
      usageDepthKey: "completion",
      realWorldExample: null,
    },
  });
  expect(forged.status()).toBe(400);

  // An option that belongs to a different question is refused at the service layer, so a tampered
  // payload cannot file an answer under the wrong move.
  const mismatched = await page.request.post("/api/assessment/answer", {
    data: { questionKey: "q01", optionKey: "q02-a" },
  });
  expect(mismatched.status()).toBe(400);

  // --- Review and file -------------------------------------------------------
  await page.getByRole("link", { name: /review & submit/i }).click();
  await expect(page).toHaveURL(/\/assessment\/confirm$/);

  const rows = page.locator("main ol > li");
  await expect(rows).toHaveCount(21);
  // Scoped to `main`: the framework's own route announcer is also a role=alert element.
  await expect(page.locator("main [role=alert]")).toHaveCount(0);

  const filed = page.waitForResponse(
    (response) =>
      response.url().includes("/api/assessment/submit") && response.status() === 200,
  );
  const [submission] = await Promise.all([
    filed,
    page.getByRole("button", { name: /submit this record/i }).click(),
  ]);

  // The score is computed on the server and deliberately withheld from the candidate: the response
  // must carry no score, no competency and no rubric detail.
  const body = await submission.text();
  expect(body).not.toMatch(/score|competenc|rubric|weight/i);

  await expect(page).toHaveURL(/\/assessment\/submitted$/);
  await expect(page.getByText("FILED", { exact: true })).toBeVisible();
  await expect(page.getByText(/your record is with the hiring team/i)).toBeVisible();

  // --- The record is closed --------------------------------------------------
  await page.goto("/assessment?move=1");
  await expect(page).toHaveURL(/\/assessment\/submitted$/);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /view your record/i })).toBeVisible();

  // A second browser knows only the email address. That must not be enough to reach the record.
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto("/");
  await strangerPage.getByLabel("Name").fill("Someone Else");
  await strangerPage.getByLabel("Email").fill(email);
  await strangerPage.getByRole("button", { name: /begin the assessment/i }).click();
  await expect(strangerPage.locator("form [role=alert]")).toBeVisible();
  await expect(strangerPage).toHaveURL(/\/$/);
  await stranger.close();
});
