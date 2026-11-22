// Reliability under normal use: bad input, the same action twice, stale tabs, refresh, slow AI.
// Every case must end in one clear result: never a duplicate, a silent no-op or an endless spinner.
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 20_000 });

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function actAs(page: Page, label: string) {
  await page.getByLabel("Acting as").selectOption({ label });
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText(label);
  await expect(page.getByText("Switching…")).toHaveCount(0);
}

async function waitForAI(page: Page) {
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
}

test("same form submitted twice creates one draft", async ({ page }) => {
  await startDemo(page);
  await page.goto("/app/drafts/new");
  const title = `Twice ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Content").fill("Cocoa Crunch is made with roasted cocoa and dates. Order at urjabites.in.");
  // Two submits of the same form before the first one finishes.
  await page.evaluate(() => {
    const form = document.querySelector("textarea#body")!.closest("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await page.goto("/app");
  await expect(page.locator("main a[href^='/app/drafts/']").filter({ hasText: title })).toHaveCount(1);
});

test("whitespace-only content is refused with a message", async ({ page }) => {
  await startDemo(page);
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("Blank");
  await page.getByLabel("Content").fill("      ");
  await page.getByRole("button", { name: "Check this draft" }).click();
  // (Next.js keeps its own hidden route announcer with role="alert", so match the message itself.)
  await expect(page.getByRole("alert").filter({ hasText: "Write or paste the content" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/drafts\/new$/);
});

test("AI findings arrive on their own, also after a refresh", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("Fresh text");
  await page.getByLabel("Channel").selectOption("email");
  // Unique text, so the AI really runs instead of answering from stored results.
  await page.getByLabel("Content").fill(`Stop eating junk, you know better. ${Date.now()} reasons to love Cocoa Crunch. Order now, follow us and share this email.`);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  // Code findings are on the page straight away; the AI ones follow.
  await expect(page.getByText(/dealt with|No open findings/).first()).toBeVisible();
  await expect(page.getByText(/AI checks are running/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await page.reload();
  await waitForAI(page);
  await expect(page.getByText(/Code checks \+ AI|AI unavailable/).first()).toBeVisible();
  await page.getByText("How this was checked").click();
  await expect(page.getByText(/gemini|Did not run/).first()).toBeVisible();
});

test("stale tab: an action as the wrong person explains itself instead of doing nothing", async ({ page, context }) => {
  await startDemo(page);
  // A clean draft goes straight to the brand manager.
  await page.goto("/app/drafts/new?sample=website");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toContainText("Meera");
  await actAs(page, "Meera · Brand manager");
  await expect(page.getByRole("button", { name: "Approve this version" })).toBeEnabled();

  // In another tab, the same visitor switches to Arjun (the creator).
  const other = await context.newPage();
  await other.goto("/app");
  await actAs(other, "Arjun · Creator");

  // Back in the first tab, which still shows Meera's Approve button.
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Only a reviewer or the brand manager" })).toBeVisible();
  await expect(page.getByText("In review", { exact: true }).first()).toBeVisible();
});

test("approving twice (two tabs) records one approval", async ({ page, context }) => {
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=website");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toBeVisible();
  await actAs(page, "Meera · Brand manager");
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.getByRole("button", { name: "Approve this version" })).toBeEnabled();

  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by Meera/)).toBeVisible();
  await second.getByRole("button", { name: "Approve this version" }).click();
  await expect(second.getByRole("status").filter({ hasText: /already approved|already done/i })).toBeVisible();
  await page.goto("/app/activity");
  await expect(page.locator("tbody tr").filter({ hasText: "Meera" }).filter({ hasText: "Valid" })).toHaveCount(1);
});

test("publishing twice (two tabs) creates one rulebook version", async ({ page, context }) => {
  await startDemo(page);
  await page.goto("/app/rulebook");
  await actAs(page, "Meera · Brand manager");
  const rule = page.locator("div").filter({ has: page.getByText("SOC-02", { exact: true }) }).filter({ hasText: "Edit" }).last();
  await rule.getByText("Edit", { exact: true }).click();
  await rule.locator('textarea[name="statement"]').fill("Use at most two emoji in a post, and never in place of words.");
  await rule.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Publish as v2" })).toBeVisible();
  const second = await context.newPage();
  await second.goto("/app/rulebook");
  await expect(second.getByRole("button", { name: "Publish as v2" })).toBeVisible();

  await page.getByRole("button", { name: "Publish as v2" }).click();
  await expect(page.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();
  await second.getByRole("button", { name: "Publish as v2" }).click();
  await expect(second.getByRole("status")).toContainText(/Nothing to publish|Already published/);
  await expect(second.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();
  await expect(second.getByRole("heading", { name: "Rulebook v3" })).toHaveCount(0);
});

test("the same comment posted twice is saved once", async ({ page }) => {
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=website");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const text = `Looks good to me ${Date.now()}`;
  await page.getByLabel("Comment", { exact: true }).fill(text);
  await page.evaluate(() => {
    const form = document.querySelector('input[aria-label="Comment"]')!.closest("form")!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByText(`“${text}”`)).toHaveCount(1);
  await page.reload();
  await expect(page.getByText(`“${text}”`)).toHaveCount(1);
});
