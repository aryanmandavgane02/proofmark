import { describe, expect, it } from "vitest";
import { agreement, replayCases, replayRows, summarize } from "./replay";
import { sampleRecords } from "./insights";

describe("rule-change replay", () => {
  const cases = replayCases(sampleRecords(), "MSG-01");

  it("turns every past decision on the rule into a case, with the people's verdict", () => {
    expect(cases.map((c) => [c.title, c.human])).toEqual([
      ["Diwali teaser reel caption", "flag"],
      ["Gym partner flyer", "pass"],
      ["Navratri countdown post", "flag"],
      ["Office snacking LinkedIn post", "pass"],
      ["Corporate gifting email", null], // disputed, not decided yet
    ]);
    expect(cases.find((c) => c.title === "Gym partner flyer")).toMatchObject({ decidedBy: "Meera", reason: "Fair: for gym partners the protein figure can lead." });
  });

  it("labels what would change and counts agreement with the people before and after", () => {
    // Current wording flags everything; the new wording lets the two business cases pass.
    const before = cases.map(() => ({ flag: true, reason: "Opens with protein." }));
    const after = cases.map((c) => ({ flag: !["Gym partner flyer", "Office snacking LinkedIn post"].includes(c.title), reason: "…" }));
    const rows = replayRows(cases, before, after);
    expect(rows.map((r) => r.change)).toEqual(["same", "now_pass", "same", "now_pass", "same"]);
    expect(summarize(rows)).toEqual({ cases: 5, decided: 4, changed: 2, nowPass: 2, nowFlag: 0, agreeBefore: 2, agreeAfter: 4 });
    expect(agreement(2, 4)).toBe("2 of 4 (50%)");
  });

  it("counts a case the AI left out as not flagged, and says so", () => {
    const rows = replayRows(cases.slice(0, 1), [], [{ flag: true, reason: "x" }]);
    expect(rows[0]).toMatchObject({ before: "pass", after: "flag", change: "now_flag" });
    expect(rows[0].whyBefore).toMatch(/No answer/);
  });

  it("has no cases for a rule nobody decided on", () => {
    expect(replayCases(sampleRecords(), "VIS-01")).toEqual([]);
  });
});
