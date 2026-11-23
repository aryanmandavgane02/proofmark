// Insights: a rule is flagged as unclear from real decisions, the manager rewords it,
// and the new wording is published as a new rulebook version. Also: sample history and AI-proposed wording.
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("insights: real disputes and overrides flag a rule, and clearer wording is published", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });

  // The page is useful on a first visit: sample history, labelled, already flags MSG-01
  await page.getByRole("link", { name: "Insights", exact: true }).click();
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

  // Meera rewrites the rule herself. Before it is published, it is replayed against the past decisions on TONE-04.
  test.setTimeout(180_000);
  await flagged.getByText("Or write it yourself").click();
  await flagged.getByLabel("New wording for TONE-04").fill("No pressure language such as 'Hurry' or 'Last chance' to rush people. Plain stock or date facts are fine. At most one exclamation mark.");
  await flagged.getByRole("button", { name: "Replay, then publish" }).click();
  await expect(page.getByRole("status")).toContainText("Before publishing", { timeout: 90_000 });
  const replay = page.locator("#replay-TONE-04");
  await expect(replay.getByText("Effect on past decisions, if published")).toBeVisible();
  await expect(replay.locator("tbody tr").filter({ hasText: "Should pass" })).toHaveCount(2); // the two overrides
  await page.locator("#rule-TONE-04").locator("xpath=..").getByRole("button", { name: "Accept and publish as v2" }).click();
  await expect(page.getByRole("status")).toContainText("Published rulebook v2 with the clearer wording for TONE-04");
  await expect(page.getByRole("status")).toContainText("Replay kept with v2");
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
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/app/insights");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  const msg = page.locator("#rule-MSG-01").locator("xpath=..");
  await msg.getByRole("button", { name: "Propose clearer wording" }).click();
  await expect(msg.getByText("Proposed clearer wording")).toBeVisible({ timeout: 60_000 });
  await expect(msg.getByLabel("New wording for MSG-01")).not.toHaveValue("");
  await expect(page.getByLabel("Acting as").locator("option:checked")).toHaveText(/Meera/); // the switcher keeps showing who you act as
});

test("replay: new wording for MSG-01 is replayed against every past decision before it is published", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/app/insights");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  const msg = page.locator("#rule-MSG-01").locator("xpath=..");
  await msg.getByRole("button", { name: "Propose clearer wording" }).click();
  await expect(msg.getByText("Proposed clearer wording")).toBeVisible({ timeout: 60_000 });
  await expect(msg.getByRole("button", { name: "Replay, then publish" })).toBeVisible();
  await msg.getByRole("button", { name: "Preview the effect on past decisions" }).click();

  // Every past decision on MSG-01: the people's verdict, the result under each wording and what would change.
  const replay = page.locator("#replay-MSG-01");
  await expect(replay.getByText("Effect on past decisions, if published")).toBeVisible({ timeout: 90_000 });
  await expect(replay.locator("tbody tr")).toHaveCount(5);
  await expect(replay.getByText(/of 5 past decisions would change/)).toBeVisible();
  await expect(replay.getByText(/Agreement with the people who decided: \d of 4 \(\d+%\) with the current wording, \d of 4 \(\d+%\) with the new wording/)).toBeVisible();
  for (const row of await replay.locator("tbody tr").all()) await expect(row).toContainText(/Would now pass|Would now flag|Unchanged/);
  await expect(replay.locator("tbody tr").filter({ hasText: "Not decided yet" })).toHaveCount(1);

  // The table is accessible, like every other screen (scanned once entrance animations have finished, as in accessibility.spec).
  await page.evaluate(() => Promise.all(document.getAnimations().filter((x) => x.effect?.getTiming().iterations !== Infinity).map((x) => x.finished.catch(() => null))));
  const axe = await new AxeBuilder({ page }).include("#replay-MSG-01").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join("; ")}`)).toEqual([]);

  // Published with the replay kept, and shown in the version history.
  await msg.getByRole("button", { name: "Accept and publish as v2" }).click();
  await expect(page.getByRole("status")).toContainText("Replay kept with v2");
  await page.goto("/app/rulebook");
  await page.getByText("Replay of MSG-01 kept with v2").click();
  await expect(page.locator("details").filter({ hasText: "Replay of MSG-01 kept with v2" }).locator("tbody tr")).toHaveCount(5);
});

test("replay: an edited AI rule in the rulebook is replayed before the version is published", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Start the live demo/ }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
  await page.goto("/app/rulebook");
  await page.getByLabel("Acting as").selectOption({ label: "Meera · Brand manager" });
  await expect(page.getByText("Switching…")).toHaveCount(0);
  const rule = page.locator("div").filter({ has: page.getByText("MSG-02", { exact: true }) }).filter({ hasText: "Edit" }).last();
  await rule.getByText("Edit", { exact: true }).click();
  await rule.locator('textarea[name="statement"]').fill("Every post, email and ad has one main call to action; a short sign-off such as a website address is fine.");
  await rule.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Publish as v2" })).toBeVisible();
  // Publishing first shows the replay, then publishes on the second click.
  await page.getByRole("button", { name: "Publish as v2" }).click();
  await expect(page.getByRole("status")).toContainText("Before publishing", { timeout: 90_000 });
  await expect(page.locator("#replay-MSG-02").getByText(/past decision.* would change/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rulebook v1" })).toBeVisible();
  await page.getByRole("button", { name: "Publish as v2" }).click();
  await expect(page.getByRole("heading", { name: "Rulebook v2" })).toBeVisible();
  await expect(page.getByText("Replay of MSG-02 kept with v2")).toBeVisible();
});
