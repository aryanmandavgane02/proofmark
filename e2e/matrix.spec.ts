// The reliability matrix (docs/ROUND3_PLAN.md, section 7), the rows not covered elsewhere: unusual text, addresses
// that do not exist, reasons that are too short, fact form problems, files that are not images, empty states,
// a fix accepted twice or refreshed, and a finding settled in another tab.
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 20_000 });

const DRAFT = /\/app\/drafts\/[0-9a-f-]{36}$/;

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

async function newDraft(page: Page, title: string, body: string, channel = "website") {
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Channel").selectOption(channel);
  await page.getByLabel("Content").fill(body);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 60_000 });
}

const card = (page: Page, text: string) => page.locator("div[id^=f-]").filter({ hasText: text }).first();

test("matrix: script tags, HTML, Hindi, emoji and a very long word are checked and shown as plain text", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  const longWord = "Proteinpowered".repeat(25);
  await newDraft(page, "Unusual text", `<script>window.__pwned = 1</script> <b>Bold?</b> <img src=x onerror="window.__pwned=2">\nनमस्ते! Ekdum mast bar hai, try karo 😋🍫\n${longWord}\nOrder at urjabites.in.`);
  await expect(page.locator("main")).toContainText("<script>window.__pwned = 1</script>");
  await expect(page.locator("main")).toContainText("नमस्ते! Ekdum mast bar hai");
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  // Emoji only.
  await page.setViewportSize({ width: 1280, height: 800 });
  await newDraft(page, "Emoji only", "😋🍫🔥", "instagram");
  await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: /finding|No open findings|No findings/ }).first()).toBeVisible();
});

test("matrix: an address that does not exist, or another visitor's draft, gets a friendly page", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=website");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 60_000 });
  const mine = page.url();
  const origin = new URL(mine).origin;
  for (const path of ["/app/drafts/00000000-0000-4000-8000-000000000000", "/app/drafts/not-a-draft", "/app/drafts/not-a-draft/versions", "/app/drafts/00000000-0000-4000-8000-000000000000/record", "/app/no-such-page"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page does not exist" }), path).toBeVisible();
  }
  // Another visitor (their own demo) opens my draft's address: nothing of mine is shown.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(`${origin}/`);
  await p2.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(p2).toHaveURL(/\/app$/, { timeout: 60_000 });
  await p2.goto(mine);
  await expect(p2.getByRole("heading", { name: "This page does not exist" })).toBeVisible();
  await expect(p2.locator("body")).not.toContainText("Cocoa Crunch is the flavour");
  await other.close();
});

test("matrix: a dispute reason with no real words is explained, not ignored", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=newsletter");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 90_000 });
  const c = card(page, "“boosts immunity”");
  await c.getByText("Dispute", { exact: true }).click();
  await c.getByPlaceholder("Why does this not apply here?").fill("  a  "); // long enough for the browser, one letter for us
  await c.getByRole("button", { name: "Send dispute to the reviewer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Give a reason (a few words) so the reviewer can decide." })).toBeVisible();
  await expect(page.getByText(/Disputed by Arjun/)).toHaveCount(0);
});

test("matrix: fact form problems are explained, and what was typed is kept", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/facts");
  await actAs(page, "Meera · Brand manager");
  await page.getByText("Add a fact").click();
  const form = page.locator("#add-fact form");
  await form.locator('input[name="statement"]').fill("Lots of happy snackers across India.");
  await form.locator('input[name="value"]').fill("lots");
  await form.locator('input[name="source"]').fill("Sales dashboard");
  await form.locator('input[name="owner"]').fill("Sales");
  await form.getByRole("button", { name: "Add fact" }).click();
  await expect(form.getByText("The value must be a number, like 35000 or 4.6")).toBeVisible();
  await expect(form.locator('input[name="statement"]')).toHaveValue("Lots of happy snackers across India.");
  await form.locator('input[name="value"]').fill("40000");
  await form.locator('input[name="code"]').fill("F-12");
  await form.getByRole("button", { name: "Add fact" }).click();
  await expect(form.getByText("F-12 already exists")).toBeVisible();
  await form.locator('input[name="code"]').fill("F-99");
  await form.locator('input[name="source"]').fill(" x ");
  await form.getByRole("button", { name: "Add fact" }).click();
  await expect(form.getByText("Every fact needs a source")).toBeVisible();
});

test("matrix: files that are not PNG, JPEG or WebP images are refused with a message", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new");
  await page.getByLabel("Channel").selectOption("instagram");
  const image = page.locator('input[type="file"][name="image"]');
  // A GIF: refused in the browser.
  await image.setInputFiles({ name: "party.gif", mimeType: "image/gif", buffer: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") });
  await expect(page.getByText("Use a PNG, JPEG or WebP image.")).toBeVisible();
  // Not an image at all, named .png, and an empty file: the browser cannot show them, so they are refused at once
  // and the file is cleared (the server refuses them too: "That file is not a readable image.").
  for (const bad of [{ name: "notes.png", buffer: Buffer.from("This is a text file, not a picture.") }, { name: "empty.png", buffer: Buffer.alloc(0) }]) {
    await image.setInputFiles({ ...bad, mimeType: "image/png" });
    await expect(page.getByRole("alert").filter({ hasText: /does not look like a valid image/ }), bad.name).toBeVisible();
    expect(await image.evaluate((i: HTMLInputElement) => i.files?.length ?? 0), bad.name).toBe(0);
  }
});

test("matrix: empty states say what to do next", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  // A document with no findings.
  await page.goto("/app/drafts/new?mode=document&sample=one-pager");
  await page.getByRole("button", { name: "Check this document" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 90_000 });
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "No open findings" })).toBeVisible();
  // Version history with one version.
  await page.goto(`${new URL(page.url()).pathname}/versions`);
  await expect(page.getByText(/Version 1/).first()).toBeVisible();
  // Insights, only my own work, in a workspace where I have none yet.
  await page.goto("/app/insights?view=mine");
  const main = page.locator("main");
  await expect(main).toContainText(/your own|yours/i);
  expect((await main.innerText()).trim().length).toBeGreaterThan(80);
});

test("matrix: accepting a fix twice, or refreshing after it, makes one new version", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=newsletter");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 90_000 });
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
  await card(page, "“cures”").getByRole("button", { name: "Accept fix" }).dblclick();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await expect(page.getByText(/version 3/)).toHaveCount(0);
});

test("matrix: a fix accepted in another tab is explained, not silently repeated", async ({ page, context }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=newsletter");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(DRAFT, { timeout: 90_000 });
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
  const second = await context.newPage();
  await second.goto(page.url());
  await card(page, "“cures”").getByRole("button", { name: "Accept fix" }).click();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  // The second tab still shows version 1 and its "Accept fix".
  await card(second, "“cures”").getByRole("button", { name: "Accept fix" }).click();
  await expect(second.getByRole("alert").or(second.getByRole("status")).filter({ hasText: /already|newer version|changed|no longer/i }).first()).toBeVisible({ timeout: 30_000 });
  await second.reload();
  await expect(second.getByText(/version 3/)).toHaveCount(0);
});
