// "← Back" on a draft returns to the page you came from inside the app; opened directly, it goes to Start here.
import { expect, test } from "@playwright/test";

test("draft page: Back returns to where you came from", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });
  const draft = page.url();

  // From the drafts list on Start here
  await page.goto("/app");
  await page.locator("main a[href^='/app/drafts/']").filter({ hasText: "Diwali offer post" }).first().click();
  await expect(page).toHaveURL(draft);
  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // From the review queue, after accepting a fix and switching person on the draft
  await page.goto("/app/review");
  await page.goto(draft);
  await page.locator("div[id^=f-]").filter({ hasText: "50,000+ gym-goers" }).first().getByRole("button", { name: "Accept fix" }).click();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Meera · Brand manager");
  await page.waitForTimeout(2000); // let the switch finish
  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/app\/review$/);

  // Every other app page has Back too: Review → New draft → Back returns to Review; Start here has none
  await page.goto("/app/review");
  await page.getByRole("link", { name: "New draft", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/new$/);
  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/app\/review$/);
  await page.goto("/app");
  await expect(page.getByRole("link", { name: "← Back" })).toHaveCount(0);

  // Opened directly in a new tab: Back goes to Start here, never out of the app
  const tab = await context.newPage();
  await tab.goto(draft);
  await tab.evaluate(() => sessionStorage.clear());
  await tab.getByRole("link", { name: "← Back" }).click();
  await expect(tab).toHaveURL(/\/app$/);
});
