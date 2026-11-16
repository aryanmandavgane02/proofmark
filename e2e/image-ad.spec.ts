// Visual identity: the sample ad image is checked for colours, logo use and text inside the picture.
import { expect, test } from "@playwright/test";

test("image ad: findings about the picture, with an AI alt text the creator can accept", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/drafts/new?sample=diwali-ad");
  await expect(page.getByAltText("Preview of the image to check")).toBeVisible();
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\//, { timeout: 90_000 });
  await expect(page.locator("figure img")).toBeVisible();
  await expect(page.getByText(/Colour #F26A1B covers/)).toBeVisible();
  await expect(page.getByText(/In the image: .*#1/).first()).toBeVisible();
  for (const cat of ["claims", "visual", "accessibility", "tone"]) await expect(page.getByText(cat, { exact: true }).first()).toBeVisible();
  const alt = page.locator("div[id^=f-]").filter({ hasText: "(no alt text)" });
  await alt.getByRole("button", { name: "Accept fix" }).click();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await expect(page.getByText("(none)")).toHaveCount(0);
});
