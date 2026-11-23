// Coming back to the home page: continue the demo, or start over with a fresh workspace (with confirmation).
import { expect, test } from "@playwright/test";

test("home page: continue the demo, or start over after confirming", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });

  // The logo in the app goes back to the home page
  await page.getByRole("link", { name: "Proofmark home page" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /Continue your demo/ })).toBeVisible();

  // Cancel keeps everything
  await page.getByText("Start over with a fresh workspace").click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Start over with a fresh workspace")).toBeVisible();
  await page.getByRole("link", { name: /Continue your demo/ }).click();
  await expect(page.getByText("Diwali offer post").first()).toBeVisible();

  // The "Home page" button in the app header also goes back
  await page.getByRole("link", { name: "Home page", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  // Start fresh: a new, empty workspace
  await page.getByText("Start over with a fresh workspace").click();
  await page.getByRole("button", { name: /Yes, start fresh/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await expect(page.getByText("No drafts yet. Start with step 1 above.")).toBeVisible();
  await expect(page.getByText(/0 of 5 done/)).toBeVisible();
});
