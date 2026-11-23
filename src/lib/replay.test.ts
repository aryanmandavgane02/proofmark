import { describe, expect, it } from "vitest";
import { agreement, replayCases, replayExample, replayRows, replayVerdict, summarize } from "./replay";
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

describe("replay in plain words", () => {
  const sm = (agreeBefore: number, agreeAfter: number, decided = 4) => ({ cases: 5, decided, changed: 2, nowPass: 2, nowFlag: 0, agreeBefore, agreeAfter });
  it("says whether the new wording matches people's decisions better, as well, or worse", () => {
    expect(replayVerdict(sm(2, 4))).toEqual({ tone: "better", text: "The new wording matches people's past decisions better: it agrees with 4 of 4, the current wording with 2 of 4." });
    expect(replayVerdict(sm(3, 3)).tone).toBe("same");
    expect(replayVerdict(sm(3, 1)).text).toMatch(/^Careful, .* agrees with 1 of 4, the current wording with 3 of 4\.$/);
    expect(replayVerdict(sm(0, 0, 0)).tone).toBe("none");
  });
  it("tells one past finding as a sentence, naming who decided and whether the new wording agrees", () => {
    const row = { key: "k", quote: "Hurry, offer ends soon", channel: "instagram", title: "Diwali offer post", sample: true, human: "pass" as const, decidedBy: "Ritu", reason: null, before: "flag" as const, after: "pass" as const, change: "now_pass" as const, whyBefore: "", whyAfter: "" };
    expect(replayExample(row)).toBe("“Hurry, offer ends soon” (Diwali offer post): Ritu overrode it, so it should pass. The current wording flags it; the new wording passes it, as Ritu decided.");
    expect(replayExample({ ...row, human: "flag", after: "pass" })).toMatch(/Ritu agreed it was a problem\. .*passes it, although Ritu decided otherwise\.$/);
    expect(replayExample({ ...row, human: null, decidedBy: null })).toMatch(/no one has decided it yet\. The current wording flags it; the new wording passes it\.$/);
  });
});
