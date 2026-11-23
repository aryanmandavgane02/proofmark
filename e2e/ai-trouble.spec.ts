// AI trouble (reliability matrix): when the AI cannot run, the code findings are still shown, the reason is stated,
// and the checks can be run again. Needs a server with the AI turned away, so it is skipped unless AI_OFF is set:
//   AI_WORKSPACE_DAILY_CAP=0 npm run dev        (then, in another terminal)
//   AI_OFF=1 npx playwright test e2e/ai-trouble.spec.ts
import { expect, test } from "@playwright/test";

test.skip(!process.env.AI_OFF, "needs a server started with AI_WORKSPACE_DAILY_CAP=0");

test("AI trouble: code findings are shown, the reason is stated, and the checks can be run again", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("AI turned away");
  await page.getByLabel("Channel").selectOption("website");
  // New wording every run, so no stored AI answer can be reused.
  await page.getByLabel("Content").fill(`Our bars boost immunity, says batch ${Date.now()}. Order at urjabites.in.`);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const notice = page.getByRole("status").filter({ hasText: "AI checks did not run this time" });
  await expect(notice).toBeVisible({ timeout: 60_000 });
  await expect(notice).toContainText("This workspace has used its AI checks for today.");
  await expect(page.locator("div[id^=f-]").filter({ hasText: "“boost immunity”" })).toContainText("CLAIM-03");
  await notice.getByRole("button", { name: "Run the checks again" }).click();
  await expect(page.getByRole("status").filter({ hasText: "AI checks did not run this time" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("div[id^=f-]").filter({ hasText: "“boost immunity”" })).toContainText("CLAIM-03");
});
