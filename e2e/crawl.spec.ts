// Every page as every person, on a desktop and a phone screen: no error in the browser console, no stray "undefined",
// "NaN" or "[object Object]", nothing wider than the phone, and no link to a page that fails.
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 20_000 });
test.describe.configure({ mode: "parallel" });

const PEOPLE = ["Arjun", "Meera", "Ritu", "Kabir"];
const PAGES = ["/", "/app", "/app/drafts/new", "/app/drafts/new?mode=document", "/app/review", "/app/insights", "/app/rulebook", "/app/rulebook/import", "/app/facts", "/app/activity", "/app/ai", "/app/notifications"];
const ODD = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date/;
const DRAFT_PAGE = /^\/app\/drafts\/[0-9a-f-]{36}(?:\/(?:versions|record))?$/;

async function actAs(page: Page, name: string) {
  const select = page.getByLabel("Acting as");
  const options = await select.locator("option").allTextContents();
  const label = options.map((o) => o.trim()).find((o) => o.startsWith(`${name} ·`));
  expect(label, `${name} is one of the people`).toBeTruthy();
  await select.selectOption({ label: label! });
  await expect(select.locator("option:checked")).toHaveText(label!);
  await expect(page.getByText("Switching…")).toHaveCount(0);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator('[aria-label="Loading"]')).toHaveCount(0);
}

for (const person of PEOPLE) {
  test(`crawl: every page as ${person}, on a desktop and a phone`, async ({ page }) => {
    test.setTimeout(600_000);
    const problems: string[] = [];
    const where = () => new URL(page.url()).pathname;
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`${where()}: console error: ${m.text().slice(0, 200)}`);
    });
    page.on("pageerror", (e) => problems.push(`${where()}: page error: ${e.message.slice(0, 200)}`));

    await page.goto("/");
    await page.getByRole("button", { name: /Start the live demo/ }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
    await actAs(page, person);

    const links = new Set<string>();
    const visit = async (path: string, width: number) => {
      await page.setViewportSize({ width, height: 800 });
      const res = await page.goto(path);
      await settle(page);
      const label = `${path} (${width}px)`;
      if (!res || res.status() >= 400) problems.push(`${label}: status ${res?.status()}`);
      const text = await page.locator("body").innerText();
      const odd = text.match(ODD);
      if (odd) problems.push(`${label}: odd text “${text.slice(Math.max(0, odd.index! - 40), odd.index! + 40).replace(/\s+/g, " ")}”`);
      if (/Application error|Something went wrong|This page could not be found/i.test(text) && !path.includes("does-not-exist")) problems.push(`${label}: error page`);
      if (width < 600) {
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        if (w > width) problems.push(`${label}: ${w}px wide`);
      } else {
        for (const href of await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) {
          if (href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0]);
        }
      }
    };

    for (const p of PAGES) await visit(p, 1280);
    // Draft pages found on those pages (the review queue, the library, the audit trail), with their linked subpages.
    const drafts = [...links].filter((l) => DRAFT_PAGE.test(l)).slice(0, 6);
    expect(drafts.length, "draft pages are linked from the pages above").toBeGreaterThanOrEqual(3);
    for (const d of drafts) await visit(d, 1280);
    for (const sub of [...links].filter((l) => DRAFT_PAGE.test(l) && !drafts.includes(l)).slice(0, 4)) await visit(sub, 1280);
    const visited = [...PAGES, ...[...links].filter((l) => DRAFT_PAGE.test(l)).slice(0, 10)];
    for (const p of visited) await visit(p, 375);

    // Every internal link answers (with this person's session).
    expect(links.size, "links were found to check").toBeGreaterThan(15);
    console.log(`${person}: ${PAGES.length + Math.min(10, [...links].filter((l) => DRAFT_PAGE.test(l)).length)} pages at two widths, ${links.size} links`);
    for (const href of [...links].filter((l) => l && !l.startsWith("/_next"))) {
      const r = await page.request.get(href, { maxRedirects: 3 });
      if (r.status() >= 400) problems.push(`link ${href}: status ${r.status()}`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
}
