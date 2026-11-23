// "Acting as" must always show the person the page is rendered for, however you switch.
import { expect, test } from "@playwright/test";

test("acting as: the dropdown always matches who you are acting as", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  const shown = () => page.getByLabel("Acting as").locator("option:checked");

  for (const [label, name] of [["Meera · Brand manager", "Meera"], ["Ritu · Legal and compliance", "Ritu"], ["Arjun · Creator", "Arjun"], ["Kabir · Design lead", "Kabir"]]) {
    await page.getByLabel("Acting as").selectOption({ label });
    await expect(page.getByRole("heading", { name: `Welcome, ${name}` })).toBeVisible();
    await expect(shown()).toHaveText(label);
  }

  // The guided steps switch person too: step 1 is done as Arjun
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/new/);
  await expect(shown()).toHaveText("Arjun · Creator");

  // And on another page, the header follows a switch
  await page.goto("/app/rulebook");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByRole("link", { name: "Import rules from a PDF" })).toBeVisible();
  await expect(shown()).toHaveText("Meera · Brand manager");
});
