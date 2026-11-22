// Improvement 1 (Round 3): PDF documents and decks. Every page is checked, every finding names its page and quotes
// its text, fonts outside the brand typefaces are flagged, and the reviewer approves the exact file.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

const card = (page: Page, quote: string) => page.locator("[id^='f-']").filter({ hasText: quote });

test("document: a 10-page deck is checked page by page", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  await page.goto("/app/drafts/new");
  await page.getByRole("link", { name: "Document (PDF)" }).click();
  await page.getByRole("button", { name: /Diwali retail deck/ }).click();
  await page.getByRole("button", { name: "Check this document" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByText(/Document \(PDF\) · 10 pages/)).toBeVisible();
  await waitForAI(page);

  // Every page is shown, with a link to that page of the stored PDF.
  for (let n = 1; n <= 10; n++) await expect(page.getByRole("heading", { name: `Page ${n}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open page 4 in the PDF ↗" })).toHaveAttribute("href", /#page=4$/);

  // Each planted problem is found on its page, with the quoted text.
  const expected: [string, string, number][] = [
    ["50,000+ customers", "CLAIM-01", 2], ["boosts immunity", "CLAIM-03", 3], ["India's #1 protein bar", "CLAIM-02", 5],
    ["20% off the 6-bar box until 30 November.", "DISC-01", 6], ["guilt-free", "TERM-01", 7], ["Hurry, festive stock ends soon!", "TONE-04", 8], ["LIMITED", "TONE-03", 8],
  ];
  for (const [quote, rule, n] of expected) {
    const c = card(page, `“${quote}”`).first();
    await expect(c).toContainText(rule);
    await expect(c.getByRole("link", { name: `Page ${n}`, exact: true })).toBeVisible();
  }
  // Fonts outside the brand typefaces are flagged: page 4 is set in Georgia.
  const font = page.locator("[id^='f-']").filter({ hasText: "VIS-03" });
  await expect(font).toHaveCount(1);
  await expect(font).toContainText("Georgia");
  await expect(font.getByRole("link", { name: "Page 4", exact: true })).toBeVisible();
  await expect(page.locator("#page-4").getByText(/Georgia ✗/)).toBeVisible();
  await expect(page.locator("#page-2").getByText(/Georgia/)).toHaveCount(0);

  // A PDF cannot be edited here, so there is no "Accept fix"; the way forward is a corrected PDF.
  await expect(page.getByRole("button", { name: "Accept fix" })).toHaveCount(0);
  await expect(page.getByText("Upload a corrected PDF")).toBeVisible();
  // Blockers stop it going to review, as for any draft.
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
});

test("document: the reviewer approves the exact file", async ({ page }) => {
  test.setTimeout(150_000);
  const hash = createHash("sha256").update(readFileSync("public/samples/urja-cocoa-crunch-one-pager.pdf")).digest("hex");
  await startDemo(page);
  await page.goto("/app/drafts/new?mode=document&sample=one-pager");
  await page.getByRole("button", { name: "Check this document" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  await expect(page.getByText(`SHA-256 ${hash.slice(0, 12)}`)).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toBeVisible();
  await actAs(page, "Meera · Brand manager");
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by Meera/)).toBeVisible();
  await expect(page.getByText("Approved file", { exact: true })).toBeVisible();
  await expect(page.getByText(hash, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the approved file ↗" })).toHaveAttribute("href", /\/documents\//);
});

test("document: an uploaded PDF, the same file again, then a corrected PDF as the next version", async ({ page }) => {
  test.setTimeout(180_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?mode=document");
  // A real upload: the browser puts the file straight into private storage with a one-time link.
  await page.getByLabel("PDF document").setInputFiles("eval/docs/urja-store-brochure-arial.pdf");
  await page.getByLabel("Title").fill("Store brochure");
  await page.getByRole("button", { name: "Check this document" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  await expect(page.locator("[id^='f-']").filter({ hasText: "VIS-03" })).toHaveCount(2); // Arial on both pages
  await expect(card(page, "“energy bar”").getByRole("link", { name: "Page 1", exact: true })).toBeVisible();

  await page.getByText("Upload a corrected PDF").click();
  await page.getByLabel("Corrected PDF").setInputFiles("eval/docs/urja-store-brochure-arial.pdf");
  await page.getByRole("button", { name: "Upload and check again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "same file as version 1" })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Corrected PDF").setInputFiles("public/samples/urja-cocoa-crunch-one-pager.pdf");
  await page.getByRole("button", { name: "Upload and check again" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 2 uploaded" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/· version 2 ·/)).toBeVisible();
  await waitForAI(page);
  await expect(page.locator("[id^='f-']").filter({ hasText: "VIS-03" })).toHaveCount(0);
});

test("document: files that cannot be checked are refused with the reason", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page);
  const cases: [string, RegExp][] = [
    ["empty", /The file is empty/],
    ["not-a-pdf", /not a PDF/],
    ["too-many-pages", /21 pages\. Proofmark checks documents of up to 20 pages/],
    ["scanned", /no text that can be selected/],
    ["password", /protected with a password/],
    ["damaged", /could not be read; it may be damaged/],
  ];
  for (const [file, reason] of cases) {
    await page.goto("/app/drafts/new?mode=document");
    await page.getByLabel("Title").fill(`Bad file: ${file}`);
    await page.getByLabel("PDF document").setInputFiles(`e2e/fixtures/${file}.pdf`);
    if (file !== "empty") await page.getByRole("button", { name: "Check this document" }).click();
    await expect(page.getByRole("alert").filter({ hasText: reason }), file).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/app\/drafts\/new\?mode=document$/);
  }
  // Nothing was created for any of them.
  await page.goto("/app");
  await expect(page.getByText(/Bad file:/)).toHaveCount(0);
});
