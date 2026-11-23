// Review workflow: a revision, a dispute, a comment, an approval, then an edit that needs re-approval.
import { expect, test } from "@playwright/test";

test("workflow: revision, dispute, approval, and re-approval after an edit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/app/drafts/new?sample=newsletter");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  const draftUrl = page.url();
  const card = (text: string) => page.locator("div[id^=f-]").filter({ hasText: text }).first();

  // Revision: accept the fix for "cures". Only the fixed text changed, so the AI is not asked again.
  // (Its answers can be reused once the first check's AI step has finished.)
  await expect(page.getByText(/AI checks are running/)).toHaveCount(0, { timeout: 90_000 });
  await card("“cures”").getByRole("button", { name: "Accept fix" }).click();
  await expect(page.getByText(/version 2/).first()).toBeVisible();
  await page.getByText("How this was checked").click();
  await expect(page.getByText(/Not asked again: only the text you fixed changed/)).toBeVisible();

  // Dispute the other blocker and comment on a finding
  await card("“boosts immunity”").getByText("Dispute", { exact: true }).click();
  await card("“boosts immunity”").getByPlaceholder("Why does this not apply here?").fill("Our nutritionist approved this wording.");
  await card("“boosts immunity”").getByRole("button", { name: "Send dispute to the reviewer" }).click();
  await expect(page.getByText(/Disputed by Arjun/)).toBeVisible();
  await card("“15 g of protein”").getByText("Comment on this finding").click();
  await card("“15 g of protein”").getByPlaceholder(/Comment as Arjun/).fill("Checking with Product before I change it.");
  await card("“15 g of protein”").getByRole("button", { name: "Post" }).click();
  await expect(card("“15 g of protein”").getByText("Checking with Product before I change it.")).toBeVisible();

  // Submit: claims go to legal
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Assigned to/)).toContainText("Ritu");

  // Ritu upholds the dispute: it must be fixed, so approval is blocked
  await page.getByLabel("Acting as").selectOption({ label: "Ritu · Legal and compliance" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  const decision = page.locator("form").filter({ hasText: "Your decision as Ritu" });
  await decision.getByPlaceholder(/Reason/).fill("Immunity claims need regulatory approval; remove it.");
  await decision.getByRole("button", { name: /Uphold/ }).click();
  await expect(page.getByText(/Upheld by Ritu/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve this version" })).toBeDisabled();
  await page.getByText("Request changes", { exact: true }).click();
  await page.getByPlaceholder("What should the creator change?").fill("Please remove the immunity claim.");
  await page.getByRole("button", { name: "Send back to the creator" }).click();
  await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();

  // Arjun edits the text by hand (a new version), resubmits; Ritu approves
  await page.getByLabel("Acting as").selectOption({ label: "Arjun · Creator" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  await page.getByText("Edit the text yourself").click();
  const body = page.getByLabel("Content");
  await body.fill((await body.inputValue()).replace("because it boosts immunity and ", ""));
  await page.getByRole("button", { name: /Save as a new version/ }).click();
  await expect(page.getByText(/version 3/).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByLabel("Acting as").selectOption({ label: "Ritu · Legal and compliance" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by Ritu/)).toBeVisible();

  // A later edit withdraws the approval
  await page.getByLabel("Acting as").selectOption({ label: "Arjun · Creator" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  await page.getByText("Edit the text yourself").click();
  await page.getByLabel("Content").fill((await page.getByLabel("Content").inputValue()) + "\nP.S. New flavours soon.");
  await page.getByRole("button", { name: /Save as a new version/ }).click();
  await expect(page.getByText(/version 4/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/edited it after approval, so it needs a new approval/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();

  // History and audit trail
  await page.goto(`${draftUrl}/versions?from=3&to=4`);
  await expect(page.locator("ins").filter({ hasText: "New flavours soon" })).toBeVisible();
  await page.goto("/app/activity");
  await expect(page.getByText("Withdrawn: edited after approval")).toBeVisible();
});
