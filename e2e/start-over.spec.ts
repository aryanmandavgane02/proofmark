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

test("home page: a demo that could not be started says why, instead of an error page", async ({ page }) => {
  // The start actions send the visitor here when the sign-in service refuses a new session (many visitors on one
  // network within an hour) or setting up the workspace fails.
  const problem = (text: string | RegExp) => page.getByRole("alert").filter({ hasText: text });
  await page.goto("/?demo=busy");
  await expect(problem("Too many new demos were started from this network in the last hour")).toBeVisible();
  await expect(page.getByRole("button", { name: /Start the live demo/ })).toBeVisible();
  await page.goto("/?demo=failed");
  await expect(problem("The demo could not be set up just now. Please try again in a moment.")).toBeVisible();
  await page.goto("/?demo=anything-else");
  await expect(problem(/Too many new demos|could not be set up/)).toHaveCount(0);
});

test("home page: an unknown or built-in name in the address is ignored, never an error page", async ({ page }) => {
  for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const res = await page.goto(`/?demo=${name}`);
    expect(res?.status(), name).toBe(200);
    await expect(page.getByRole("button", { name: /Start the live demo|Continue your demo/ }).first(), name).toBeVisible();
  }
});

test("home page: “Yes, start fresh” still starts a demo when the old one is gone", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Continue your demo/ })).toBeVisible();
  // The page still offers to start over, but the demo behind it is gone (its sign-in expired, was cleared, or the
  // workspace was removed after days unused). The click must still lead somewhere, never back to the same page.
  await context.clearCookies();
  await page.getByText("Start over with a fresh workspace").click();
  await page.getByRole("button", { name: /Yes, start fresh/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await expect(page.getByText(/0 of 5 done/)).toBeVisible();
});
