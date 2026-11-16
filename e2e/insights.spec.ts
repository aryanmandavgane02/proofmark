// Insights: a rule is flagged as unclear from real decisions, the manager rewords it,
// and the new wording is published as a new rulebook version. Also: sample history and AI-proposed wording.
import { expect, test } from "@playwright/test";

test("insights: real disputes and overrides flag a rule, and clearer wording is published", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);

  // The page is useful on a first visit: sample history, labelled, already flags MSG-01
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page.getByText(/sample findings/)).toBeVisible();
  await expect(page.locator("#rule-MSG-01")).toContainText("May be unclear");
  await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();

  // Arjun writes a post with three pressure phrases and disputes two of them
  await page.goto("/app/drafts/new");
  await page.getByLabel("Title").fill("Stock clearance post");
  await page.getByLabel("Channel").selectOption("instagram");
  await page.getByLabel("Content").fill("Hurry, our Cocoa Crunch protein bars are back. Last chance to try the Diwali box. Act now.");
  await page.getByRole("button", { name: "Check this draft" }).click();
  await expect(page).toHaveURL(/\/app\/drafts\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  const card = (text: string) => page.locator("div[id^=f-]").filter({ hasText: text }).first();
  for (const phrase of ["Why: “Hurry” is pressure language", "Why: “Last chance” is pressure language"]) {
    await card(phrase).getByText("Dispute", { exact: true }).click();
    await card(phrase).getByPlaceholder("Why does this not apply here?").fill("Stock really is limited this week; this is plain information.");
    await card(phrase).getByRole("button", { name: "Send dispute to the reviewer" }).click();
    await expect(card(phrase).getByText(/Disputed by Arjun/)).toBeVisible();
  }

  // Meera overrides both
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  for (let n = 0; n < 2; n++) {
    const form = page.locator("form").filter({ hasText: "Your decision as Meera" }).first();
    await form.getByPlaceholder(/Reason/).fill("Fair, it is factual stock information.");
    await form.getByRole("button", { name: /Override/ }).click();
    await expect(page.locator("form").filter({ hasText: "Your decision as Meera" })).toHaveCount(1 - n);
  }

  // Yours only: TONE-04 is flagged from these real decisions
  await page.goto("/app/insights?view=mine");
  const flagged = page.locator("#rule-TONE-04").locator("xpath=..");
  await expect(flagged).toContainText("May be unclear");
  await expect(flagged).toContainText("reviewers overrode 2");
  await expect(flagged.getByText("Yours", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/No rule is flagged/)).toHaveCount(0);

  // Meera rewrites the rule herself and publishes it as rulebook v2
  await flagged.getByText("Or write it yourself").click();
  await flagged.getByLabel("New wording for TONE-04").fill("No pressure language such as 'Hurry' or 'Last chance' to rush people. Plain stock or date facts are fine. At most one exclamation mark.");
  await flagged.getByRole("button", { name: "Save and publish as v2" }).click();
  await expect(page.getByRole("status")).toContainText("Published rulebook v2 with the clearer wording for TONE-04");
  await expect(page.getByText("Recently clarified")).toBeVisible();
  await expect(page.locator("#rule-TONE-04")).toHaveCount(0);

  await page.goto("/app/rulebook");
  await expect(page.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: "Plain stock or date facts are fine." })).toBeVisible();

  // Decisions are kept as test cases
  await page.goto("/app/insights?view=mine");
  const cases = await page.request.get("/app/insights/cases?view=mine");
  const json = await cases.json();
  expect(json.cases.filter((c: { rule: string; expected: string }) => c.rule === "TONE-04" && c.expected === "pass")).toHaveLength(2);
});

test("insights: the AI proposes clearer wording from the sample decisions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/insights");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  const msg = page.locator("#rule-MSG-01").locator("xpath=..");
  await msg.getByRole("button", { name: "Propose clearer wording" }).click();
  await expect(msg.getByText("Proposed clearer wording")).toBeVisible({ timeout: 60_000 });
  await expect(msg.getByLabel("New wording for MSG-01")).not.toHaveValue("");
  await expect(msg.getByRole("button", { name: /Accept and publish as v2/ })).toBeVisible();
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText(/Meera/); // the switcher keeps showing who you act as
});
