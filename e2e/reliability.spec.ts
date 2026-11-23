// Reliability under normal use: bad input, the same action twice, stale tabs, refresh, slow AI.
// Every case must end in one clear result: never a duplicate, a silent no-op or an endless spinner.
import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ actionTimeout: 20_000 });

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
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

test("going back after creating a draft and sending other content makes a second draft", async ({ page }) => {
  await startDemo(page);
  await page.goto("/app/drafts/new");
  const first = `Back one ${Date.now()}`;
  await page.getByLabel("Title").fill(first);
  await page.getByLabel("Content").fill("Cocoa Crunch is made with roasted cocoa and dates. Order at urjabites.in.");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const firstUrl = page.url();
  // The browser's Back button can bring back the same form (and its token); new content must still make a new draft.
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/drafts\/new$/);
  const second = `Back two ${Date.now()}`;
  await page.getByLabel("Title").fill(second);
  await page.getByLabel("Content").fill("Cocoa Crunch is baked, never fried. Order at urjabites.in.");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  expect(page.url()).not.toBe(firstUrl);
  await expect(page.getByText(second).first()).toBeVisible();
  await page.goto("/app");
  await expect(page.locator("main a[href^='/app/drafts/']").filter({ hasText: /Back (one|two) / })).toHaveCount(2);
});

test("text typed before the page finishes loading is kept when the form changes", async ({ page }) => {
  await startDemo(page);
  // Hold back the page's scripts, as on a slow phone, and type while the form is only HTML.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/_next\/static\/chunks\/.+\.js/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/app/drafts/new", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Title").fill("Typed early");
  await page.getByLabel("Content").fill("Roasted cocoa and dates in every bar. Order at urjabites.in.");
  release();
  await page.waitForLoadState("networkidle");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // A change after loading must not clear what was typed.
  await page.getByLabel("Channel").selectOption("website");
  await expect(page.getByLabel("Title")).toHaveValue("Typed early");
  await expect(page.getByLabel("Content")).toHaveValue(/Roasted cocoa and dates/);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Typed early" })).toBeVisible();
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

test("while the AI runs, the page refreshes one request at a time, even when the server is slow", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("Slow refreshes");
  await page.getByLabel("Channel").selectOption("email");
  // Unique text, so the AI really runs instead of answering from stored results.
  await page.getByLabel("Content").fill(`Stop eating junk, you know better. ${Date.now()} reasons to love Cocoa Crunch. Order now, follow us and share this email.`);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const draftPath = new URL(page.url()).pathname;
  // Every refresh of this page answers 3 seconds late. Refreshes and actions share one queue in the browser,
  // so refreshes on a fixed timer would pile up here and hold up the next click.
  const isRefresh = (r: Request) =>
    r.method() === "GET" && r.headers()["rsc"] === "1" && !r.headers()["next-router-prefetch"] && new URL(r.url()).pathname === draftPath;
  const open = new Set<Request>();
  let most = 0;
  let refreshes = 0;
  page.on("request", (r) => {
    if (!isRefresh(r)) return;
    open.add(r);
    refreshes++;
    most = Math.max(most, open.size);
  });
  page.on("requestfinished", (r) => open.delete(r));
  page.on("requestfailed", (r) => open.delete(r));
  await page.route((url) => url.pathname === draftPath, async (route) => {
    if (isRefresh(route.request())) await new Promise((done) => setTimeout(done, 3000));
    await route.continue();
  });
  await waitForAI(page);
  expect(refreshes, "the page refreshed while the AI ran").toBeGreaterThan(0);
  expect(most, "refreshes in flight at once").toBe(1);
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
  await expect(page.getByText(/dealt with|No open findings|No findings from code checks/).first()).toBeVisible();
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
  await expect(page.locator("tbody tr").filter({ hasText: "Product page: Cocoa Crunch" }).filter({ hasText: "Valid" })).toHaveCount(1);
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
