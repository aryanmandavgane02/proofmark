import { describe, expect, it } from "vitest";
import { verifyImportedRules, type DraftedRule } from "./import-verify";

const pages = ["Cover page.", "Paid partnerships: every influencer or paid post must say “Paid partnership” or #ad in its first line.", "Competitors: never name another snack brand."];
const base: DraftedRule = { category: "messaging", title: "Paid posts", statement: "Label paid posts.", severity: "major", source_quote: "every influencer or paid post must say", source_page: 2 };
const existing = [{ code: "MSG-01", source_quote: "Lead with taste" }, { code: "MSG-02", source_quote: "One clear call to action" }];

describe("verifyImportedRules", () => {
  it("keeps a rule whose quote is on its page and gives it the next free code", () => {
    const { rules } = verifyImportedRules([base], pages, existing);
    expect(rules[0].code).toBe("MSG-03");
    expect(rules[0].page_corrected).toBe(false);
  });
  it("corrects a wrong page number", () => {
    const { rules } = verifyImportedRules([{ ...base, source_page: 3 }], pages, existing);
    expect(rules[0].source_page).toBe(2);
    expect(rules[0].page_corrected).toBe(true);
  });
  it("drops a quote that is not in the document", () => {
    const { rules, dropped } = verifyImportedRules([{ ...base, source_quote: "always use green packaging on weekends" }], pages, existing);
    expect(rules).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/not in the document/);
  });
  it("drops rules already in the rulebook and duplicates within the import", () => {
    const { rules, dropped } = verifyImportedRules([base, { ...base, title: "Again" }, { ...base, source_quote: "Lead with taste", source_page: 1 }], ["Lead with taste.", ...pages.slice(1)], existing);
    expect(rules).toHaveLength(1);
    expect(dropped.map((d) => d.reason).join(" ")).toMatch(/already in the rulebook as MSG-0[13]/);
  });
  it("is not fooled by an existing rule with an empty quote", () => {
    expect(verifyImportedRules([base], pages, [...existing, { code: "TONE-09", source_quote: "" }]).rules).toHaveLength(1);
  });
  it("drops incomplete rules", () => {
    expect(verifyImportedRules([{ ...base, category: "random" as never }], pages, existing).dropped).toHaveLength(1);
  });
});
