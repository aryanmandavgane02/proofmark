// Brand setup: import rules from a PDF, approve them, publish a new rulebook version, and check against it.
import { expect, test } from "@playwright/test";

test("brand setup: a brand PDF becomes approved, published rules that are enforced", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Creators cannot import
  await page.goto("/app/rulebook/import");
  await expect(page.getByText(/Only the brand manager can import rules/)).toBeVisible();

  // Meera imports the November update
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByRole("button", { name: "Import the November 2026 update" })).toBeVisible();
  await page.getByRole("button", { name: "Import the November 2026 update" }).click();
  await expect(page).toHaveURL(/\/app\/rulebook\?import=/, { timeout: 90_000 });
  await expect(page.getByText(/Imported from urja-guideline-update-nov-2026.pdf/)).toBeVisible();
  await expect(page.getByText("(quote verified in the document)").first()).toBeVisible();
  const drafted = await page.getByText("(quote verified in the document)").count();
  expect(drafted).toBeGreaterThanOrEqual(3);

  // Approve all, then publish v2
  await page.getByRole("button", { name: /Approve all \d+ verified rules/ }).click();
  await expect(page.getByText(/changes? not live yet/)).toBeVisible();
  await page.getByPlaceholder(/What changed/).fill("Added the November 2026 update");
  await page.getByRole("button", { name: "Publish as v2" }).click();
  await expect(page.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();
  await expect(page.getByText("Added the November 2026 update").first()).toBeVisible();

  // A new fact is live straight away: 40,000+ customers becomes a supported claim
  await page.goto("/app/facts");
  await page.getByText("Add a fact").click();
  await page.locator('input[name="statement"]').first().fill("40,000+ customers, as of Dec 2026.");
  await page.locator('input[name="value"]').first().fill("40000");
  await page.locator('select[name="unit"]').first().selectOption("count");
  await page.locator('input[name="keywords"]').first().fill("customers");
  await page.locator('input[name="source"]').first().fill("Sales dashboard, 1 Dec 2026");
  await page.locator('input[name="owner"]').first().fill("Sales");
  await page.getByRole("button", { name: "Add fact" }).click();
  await expect(page.getByText(/added\. New drafts are checked against it/)).toBeVisible();

  // A new draft is checked against v2
  await page.goto("/app/drafts/new?sample=linkedin");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  await expect(page.getByText(/checked against rulebook v2/)).toBeVisible();
  await page.goto("/app/drafts/new");
  await page.locator("#title").fill("Milestone");
  await page.locator("#channel").selectOption("email");
  await page.locator("#body").fill("Thank you to our 40,000 customers. Order a box today.");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  await expect(page.getByText(/conflicts with approved fact/)).toHaveCount(0);

  // Importing the full guide shows the duplicate check
  await page.goto("/app/rulebook/import");
  await page.getByRole("button", { name: "Import the full guide" }).click();
  await expect(page).toHaveURL(/\/app\/rulebook\?import=/, { timeout: 90_000 });
  await expect(page.getByText(/is already in the rulebook as/).first()).toBeVisible();
});
