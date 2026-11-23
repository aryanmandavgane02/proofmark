// The route a judge takes: start the demo, check the sample post, accept a fix, dispute a finding,
// submit, resolve the dispute as the reviewer and approve.
import { expect, test } from "@playwright/test";

test("judge path: draft in, cited findings out, a person approves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Guided demo" })).toBeVisible();

  // 1. Check the sample post as Arjun
  await page.getByRole("button", { name: "Open the sample post" }).click();
  await expect(page.locator("#body")).toHaveValue(/India's #1 protein bar/);
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\//);
  await expect(page.getByText(/findings?$/).first()).toBeVisible();
  for (const code of ["CLAIM-02", "CLAIM-01", "TONE-04", "DISC-01", "A11Y-01", "SOC-01"]) {
    await expect(page.getByText(code, { exact: false }).first()).toBeVisible();
  }

  // 2. Accept the fix for the wrong customer number
  const numberCard = page.locator("div[id^=f-]").filter({ hasText: "50,000+ gym-goers" }).first();
  await numberCard.getByRole("button", { name: "Accept fix" }).click();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await expect(page.locator("p.whitespace-pre-wrap")).toContainText("35,000+ customers");

  // 3. Dispute the superlative claim (a blocker) so the draft can go to review
  const claimCard = page.locator("div[id^=f-]").filter({ hasText: "India's #1 protein bar" }).first();
  await claimCard.getByText("Dispute", { exact: true }).click();
  await claimCard.getByPlaceholder("Why does this not apply here?").fill("We won the 2026 Snack Awards; proof attached in the brief.");
  await claimCard.getByRole("button", { name: "Send dispute to the reviewer" }).click();
  await expect(page.getByText(/Disputed by Arjun/)).toBeVisible();

  // 4. Submit for review: claims route to legal (Ritu)
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toContainText("Ritu");

  // 5. Act as Ritu, override the dispute, approve
  await page.getByLabel("Acting as").selectOption({ label: "Ritu · Legal and compliance" });
  await expect(page.getByText("Your decision as Ritu")).toBeVisible();
  const decision = page.locator("form").filter({ hasText: "Your decision as Ritu" });
  await decision.getByPlaceholder(/Reason/).fill("Award certificate checked; the claim is supported.");
  await decision.getByRole("button", { name: /Override/ }).click();
  await expect(page.getByText(/Overridden by Ritu/)).toBeVisible();
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by Ritu/)).toBeVisible();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
});
