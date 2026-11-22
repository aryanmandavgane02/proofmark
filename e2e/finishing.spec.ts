// Round 3 finishing touches: the improvements one click away, the logo beside logo findings, and what an approval gives
// the team (the exact text to copy, a printable record).
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 20_000 });

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
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
