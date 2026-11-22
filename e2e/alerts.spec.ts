// Improvement 2 (Round 3): outdated-content alerts. When a fact changes or ends, every approved draft that relied on it
// is listed on the fact and on Insights, its owner is told, and one click re-checks it.
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

const QUOTED_F12 = ["About us page", "Thank-you post", "Welcome email", "Milestone post", "Diwali retail deck (approved)"];
const DECOYS = ["Ratings post", "Kitchen story", "Product page: Peanut Power"];

test("alerts: editing F-12 lists every approved draft that quoted it, and one click re-checks it", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.getByRole("button", { name: /Out-of-date alerts/ }).click();
  await expect(page).toHaveURL(/\/app\/facts/);
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText("Meera · Brand manager");
  const f12 = page.locator("#fact-F-12");
  await expect(f12.getByText("Used in 5 approved drafts")).toBeVisible();

  // The customer count is corrected down.
  await f12.getByText("Edit", { exact: true }).click();
  await f12.locator('input[name="statement"]').fill("30,000+ customers, as of Nov 2026.");
  await f12.locator('input[name="value"]').fill("30000");
  await f12.getByRole("button", { name: "Save fact" }).click();
  await expect(page.getByText(/F-12 updated\. 5 approved drafts relied on the old value/)).toBeVisible({ timeout: 30_000 });

  // Every draft that quoted it, in any form, and no decoy.
  const items = page.locator("tr").filter({ hasText: "may be out of date because F-12 changed" }).locator("li");
  await expect(items).toHaveCount(5);
  for (const t of QUOTED_F12) await expect(items.filter({ hasText: t }), t).toHaveCount(1);
  for (const t of DECOYS) await expect(items.filter({ hasText: t }), t).toHaveCount(0);
  await expect(items.filter({ hasText: "Diwali retail deck" })).toContainText("(page 2)");
  await expect(items.filter({ hasText: "Thank-you post" })).toContainText("“35k customers”");

  // One click: the re-check finds the old number and sends the draft back.
  await items.filter({ hasText: "About us page" }).getByRole("button", { name: "Re-check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent “About us page” back for changes" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tr").filter({ hasText: "because F-12 changed" }).locator("li")).toHaveCount(4);
  await page.goto("/app/activity");
  await expect(page.locator("tbody tr").filter({ hasText: "About us page" }).first()).toContainText("Withdrawn: fact F-12 changed");

  // The same list is on Insights.
  await page.goto("/app/insights");
  await expect(page.locator("#outdated li").filter({ hasText: "Welcome email" })).toContainText("Fact changed");

  // Arjun, who owns the drafts, is told.
  await actAs(page, "Arjun · Creator");
  const bell = page.getByRole("link", { name: /Notifications for Arjun: \d+ unread/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText(/“About us page” was sent back for changes/)).toBeVisible();
  await expect(page.getByText(/Fact F-12 changed: it now says “30,000\+ customers, as of Nov 2026”/)).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("link", { name: "Notifications for Arjun", exact: true })).toBeVisible();
});

test("alerts: setting an offer's end date lists the approved drafts that mention it", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/facts");
  await actAs(page, "Meera · Brand manager");
  const f13 = page.locator("#fact-F-13");
  await expect(f13.getByText("Used in 3 approved drafts")).toBeVisible();
  await f13.getByText("Edit", { exact: true }).click();
  await f13.locator('input[name="expires_on"]').fill("2026-11-25");
  await f13.getByRole("button", { name: "Save fact" }).click();
  await expect(page.getByText(/F-13 updated\. 3 approved drafts mention it/)).toBeVisible({ timeout: 30_000 });
  const items = page.locator("tr").filter({ hasText: "because F-13 is ending" }).locator("li");
  await expect(items).toHaveCount(3);
  for (const t of ["Diwali offer email", "Diwali table post", "Diwali retail deck (approved)"]) await expect(items.filter({ hasText: t }), t).toHaveCount(1);
  await expect(items.first()).toContainText("Ends after 25 Nov");
  // Still valid until then, so a person decides whether to update it now.
  await items.filter({ hasText: "Diwali offer email" }).getByRole("button", { name: "Send back for changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent “Diwali offer email” back for changes" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tr").filter({ hasText: "because F-13 is ending" }).locator("li")).toHaveCount(2);
});

test("alerts: an offer that already ended is flagged from the first visit, and the re-check sends it back", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await expect(page.getByRole("link", { name: /Notifications for Arjun: 1 unread/ })).toBeVisible();
  await page.goto("/app/insights");
  const item = page.locator("#outdated li").filter({ hasText: "Dussehra offer post" });
  await expect(item).toContainText("Fact ended");
  await expect(item).toContainText("“15% off”");
  await item.getByRole("button", { name: "Re-check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent “Dussehra offer post” back for changes" })).toBeVisible({ timeout: 30_000 });
  // The draft now shows the finding and is waiting for changes.
  await page.locator("#outdated").getByText(/Recently resolved/).click();
  await page.locator("#outdated li").filter({ hasText: "Dussehra offer post" }).getByRole("link", { name: "Dussehra offer post" }).click();
  await expect(page.getByText("Changes requested", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[id^='f-']").filter({ hasText: "“15% off”" })).toContainText("CLAIM-01");
});

test("alerts: the same re-check from two tabs happens once", async ({ page, context }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/insights");
  const second = await context.newPage();
  await second.goto("/app/insights");
  await page.locator("#outdated li").filter({ hasText: "Dussehra offer post" }).getByRole("button", { name: "Re-check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent “Dussehra offer post” back" })).toBeVisible({ timeout: 30_000 });
  await second.locator("#outdated li").filter({ hasText: "Dussehra offer post" }).getByRole("button", { name: "Re-check" }).click();
  await expect(second.getByRole("status").filter({ hasText: /already done/i })).toBeVisible({ timeout: 30_000 });
  await second.goto("/app/activity");
  await expect(second.locator("tbody tr").filter({ hasText: "Dussehra offer post" }).filter({ hasText: "Withdrawn" })).toHaveCount(1);
});

test("alerts: changing only the wording of a number raises nothing", async ({ page }) => {
  test.setTimeout(90_000);
  await startDemo(page);
  await page.goto("/app/facts");
  await actAs(page, "Meera · Brand manager");
  const f12 = page.locator("#fact-F-12");
  await f12.getByText("Edit", { exact: true }).click();
  await f12.locator('input[name="statement"]').fill("35,000+ customers, as of mid-November 2026.");
  await f12.getByRole("button", { name: "Save fact" }).click();
  await expect(page.getByText(/F-12 updated\. The number did not change/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tr").filter({ hasText: "because F-12 changed" })).toHaveCount(0);
  await expect(f12.getByText("Used in 5 approved drafts")).toBeVisible();
});

test("alerts: a confidential fact never raises alerts that creators could read", async ({ page }) => {
  test.setTimeout(90_000);
  await startDemo(page);
  await page.goto("/app/facts");
  await actAs(page, "Meera · Brand manager");
  const f18 = page.locator("#fact-F-18");
  await f18.getByText("Edit", { exact: true }).click();
  await f18.locator('input[name="statement"]').fill("Delhi launch planned for February 2027 (confidential until announced).");
  await f18.getByRole("button", { name: "Save fact" }).click();
  await expect(page.getByText(/F-18 updated\. Confidential facts do not raise out-of-date alerts/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tr").filter({ hasText: "because F-18" })).toHaveCount(0);
});

test("alerts: editing an alerted draft settles its alert, because the new version is checked anyway", async ({ page }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await page.goto("/app/insights");
  await page.locator("#outdated li").filter({ hasText: "Dussehra offer post" }).getByRole("link", { name: "Dussehra offer post" }).click();
  await expect(page.getByText(/This approved draft may be out of date/)).toBeVisible();
  await page.getByText("Edit the text yourself").click();
  await page.getByLabel("Content", { exact: true }).fill("Cocoa, dates and a festive crunch for your family. Order a box at urjabites.in. #UrjaBites");
  await page.getByRole("button", { name: "Save as a new version and re-check" }).click();
  await expect(page.getByText(/· version 2 ·/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/This approved draft may be out of date/)).toHaveCount(0);
  await page.goto("/app/insights");
  await expect(page.locator("#outdated li").filter({ hasText: "Dussehra offer post" }).getByRole("button", { name: "Re-check" })).toHaveCount(0);
});
