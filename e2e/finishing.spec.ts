// Round 3 finishing touches: the improvements one click away, the logo beside logo findings, and what an approval gives
// the team (the exact text to copy, a printable record).
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 20_000 });

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

async function waitForAI(page: Page) {
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
}

test("start here: each Round 3 improvement is one click away, as the right person", async ({ page }) => {
  await startDemo(page);
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /New since Round 2/ }) });
  await expect(section.getByRole("button")).toHaveCount(3);
  await section.getByRole("button", { name: /Rule-change replay/ }).click();
  await expect(page).toHaveURL(/\/app\/insights#rule-MSG-01$/);
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Meera · Brand manager");
  await page.goto("/app");
  await page.locator("section").filter({ has: page.getByRole("heading", { name: /New since Round 2/ }) }).getByRole("button", { name: /PDF documents and decks/ }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/new\?mode=document&sample=diwali-deck$/);
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Arjun · Creator");
});

test("home page: each Round 3 improvement opens in one click, also on a first visit, as the right person", async ({ page }) => {
  test.setTimeout(120_000);
  const section = () => page.locator("section").filter({ has: page.getByRole("heading", { name: "New since Round 2" }) });
  // A first visit: the click also sets up the demo workspace.
  await page.goto("/");
  await expect(section().getByRole("button")).toHaveCount(3);
  await section().getByRole("button", { name: /Change fact F-12, as Meera/ }).click();
  await expect(page).toHaveURL(/\/app\/facts#fact-F-12$/, { timeout: 60_000 });
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Meera · Brand manager");
  // Back on the home page with a demo already running: the same workspace, another person.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Continue your demo/ })).toBeVisible();
  await section().getByRole("button", { name: /Check the sample deck, as Arjun/ }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/new\?mode=document&sample=diwali-deck$/);
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Arjun · Creator");
  await page.goto("/");
  await section().getByRole("button", { name: /Reword rule MSG-01, as Meera/ }).click();
  await expect(page).toHaveURL(/\/app\/insights#rule-MSG-01$/);
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Meera · Brand manager");
});

test("image ad: a logo finding shows the approved logo beside it", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=diwali-ad");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  const logoCard = page.locator("[id^='f-']").filter({ hasText: "VIS-01" });
  await expect(logoCard.getByText("The approved logo, for comparison with the one in the image.")).toBeVisible();
  await expect(logoCard.getByRole("img", { name: /approved Urja Bites logo/i })).toBeVisible();
});

test("approved draft: copy the exact approved text, and print the approval record", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startDemo(page);
  await page.goto("/app/drafts/new?sample=website");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await waitForAI(page);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toBeVisible();
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by Meera/)).toBeVisible();

  await page.getByRole("button", { name: "Copy approved text" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Cocoa Crunch is the flavour that started it all");

  await page.getByRole("link", { name: "Approval record (printable)" }).click();
  await expect(page.getByRole("heading", { name: "Product page: Cocoa Crunch" })).toBeVisible();
  await expect(page.getByText("Approved text")).toBeVisible();
  await expect(page.getByText(/Approved by/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden(); // the page prints without app chrome
  await expect(page.getByRole("link", { name: "Home page" })).toBeHidden();
});

test("rulebook: a code rule's check settings are edited on screen and used once published", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/rulebook");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  const rule = page.locator("div").filter({ has: page.getByText("TONE-02", { exact: true }) }).filter({ hasText: "Edit" }).last();
  await rule.getByText("Edit", { exact: true }).click();
  // A missing value is refused in plain words (the browser itself already stops numbers below 0).
  await rule.getByLabel("Longest sentence, in words").fill("");
  await rule.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "TONE-02: Longest sentence, in words: give a number of 0 or more." })).toBeVisible();
  // A real change: sentences of more than 12 words are now flagged.
  const again = page.locator("div").filter({ has: page.getByText("TONE-02", { exact: true }) }).filter({ hasText: "Edit" }).last();
  await again.getByText("Edit", { exact: true }).click();
  await again.getByLabel("Longest sentence, in words").fill("12");
  await again.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Edited: TONE-02/)).toBeVisible();
  await page.getByRole("button", { name: "Publish as v2" }).click();
  await expect(page.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();

  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("Long line");
  await page.getByLabel("Channel").selectOption("website");
  await page.getByLabel("Content").fill("Our bars are made with roasted cocoa and dates in our small kitchen every morning. Order at urjabites.in.");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.locator("[id^='f-']").filter({ hasText: "TONE-02" })).toContainText("at most 12 words");
});
