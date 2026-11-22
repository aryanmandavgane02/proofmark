// Proofmark's own screens: no WCAG 2.1 A/AA violations found by axe, and no sideways scrolling on a phone.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function audit(page: Page, name: string, problems: string[]) {
  // Scan what people see: wait for the page to finish loading (the loading skeleton gone), then for entrance
  // animations (fade-ins) to finish. Endless decorative ones are skipped.
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator('[aria-label="Loading"]')).toHaveCount(0);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((x) => x.effect?.getTiming().iterations !== Infinity).map((x) => x.finished.catch(() => null))));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  for (const v of r.violations) problems.push(`${name}: ${v.id} (${v.impact}) at ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join("; ")}`);
}

test("accessibility: every screen passes axe (WCAG 2.1 A and AA)", async ({ page }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  await page.goto("/");
  await audit(page, "landing", problems);
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await audit(page, "start here", problems);
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await audit(page, "new draft", problems);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });
  await audit(page, "draft with findings", problems);
  await page.goto("/app/drafts/new?sample=diwali-ad");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });
  await audit(page, "image ad", problems);
  for (const p of ["/app/review", "/app/insights", "/app/rulebook", "/app/facts", "/app/activity", "/app/ai"]) {
    await page.goto(p);
    await audit(page, p, problems);
  }
  await page.goto("/app/rulebook/import");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByRole("button", { name: "Import the November 2026 update" })).toBeVisible();
  await audit(page, "import (manager)", problems);
  await page.goto("/app/insights");
  await audit(page, "insights (manager)", problems);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("phone width: no page scrolls sideways", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });
  const wide: string[] = [];
  const measure = async (name: string) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 375) wide.push(`${name}: ${w}px`);
  };
  await measure("draft");
  for (const p of ["/", "/app", "/app/drafts/new", "/app/review", "/app/insights", "/app/rulebook", "/app/facts", "/app/activity", "/app/ai", "/app/rulebook/import"]) {
    await page.goto(p);
    await measure(p);
  }
  expect(wide, wide.join("\n")).toEqual([]);
});

test("keyboard only: start the demo and accept a fix without a mouse", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (/Start the live demo/.test((await page.evaluate(() => document.activeElement?.textContent)) ?? "")) break;
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Open the sample post" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Check this draft" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/dealt with/).first()).toBeVisible({ timeout: 60_000 });
  const fix = page.locator("div[id^=f-]").filter({ hasText: "50,000+ gym-goers" }).first().getByRole("button", { name: "Accept fix" });
  await fix.focus();
  await expect(fix).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/version 2/).first()).toBeVisible();
});
