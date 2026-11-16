import { describe, expect, it } from "vitest";
import { computeInsights, realRecords, sampleRecords, testCasesJSON, type InsightRecord, type RuleInfo } from "./insights";
import { RULES } from "./seed/urja";
import { SAMPLE_HISTORY } from "./seed/history";

const rules: RuleInfo[] = RULES.map((r) => ({ code: r.code, title: r.title, statement: r.statement, category: r.category, check_kind: r.check_kind }));
let n = 0;
const rec = (rule_code: string, decisions: InsightRecord["decisions"] = [], extra: Partial<InsightRecord> = {}): InsightRecord => ({
  key: `k${n++}`, draft: extra.draft ?? `d${n}`, draftTitle: "t", channel: "instagram", rule_code, quote: "Hurry", message: "m", label: "code",
  fact_code: null, at: "2026-11-16T10:00:00.000Z", sample: false, decisions, ...extra,
});
const dispute = { action: "dispute" as const, by: "Arjun", at: "2026-11-16T11:00:00.000Z", reason: "It is true scarcity" };
const override = { action: "override" as const, by: "Meera", at: "2026-11-16T12:00:00.000Z", reason: "Fair" };

describe("sample history", () => {
  it("only cites rules that exist, and is all labelled sample", () => {
    const codes = new Set(RULES.map((r) => r.code));
    expect(SAMPLE_HISTORY.every((h) => codes.has(h.rule_code))).toBe(true);
    expect(sampleRecords().every((r) => r.sample)).toBe(true);
  });
  it("flags MSG-01 as unclear and nothing else", () => {
    const { unclear } = computeInsights(sampleRecords(), rules);
    expect(unclear.filter((u) => u.flagged).map((u) => u.rule.code)).toEqual(["MSG-01"]);
  });
});

describe("rules that may be unclear", () => {
  it("flags a rule after two overrides from real decisions", () => {
    const recs = [rec("TONE-04", [dispute, override]), rec("TONE-04", [dispute, override]), rec("TONE-04"), rec("TONE-04")];
    const u = computeInsights(recs, rules).unclear.find((x) => x.rule.code === "TONE-04")!;
    expect(u.flagged).toBe(true);
    expect(u.sampleOnly).toBe(false);
    expect(u.why).toBe("2 of 4 findings were disputed, and reviewers overrode 2.");
  });
  it("does not flag one override, or disputes that are a small share of findings", () => {
    expect(computeInsights([rec("TONE-04", [dispute, override]), rec("TONE-04")], rules).unclear[0].flagged).toBe(false);
    const many = [...Array(3)].map(() => rec("TONE-04", [dispute])).concat([...Array(10)].map(() => rec("TONE-04")));
    expect(computeInsights(many, rules).unclear[0].flagged).toBe(false); // 3 of 13 is 23%, below the 25% share
  });
  it("ignores decisions made before the manager last reviewed the wording", () => {
    const recs = [rec("TONE-04", [dispute, override]), rec("TONE-04", [dispute, override])];
    expect(computeInsights(recs, rules, { "TONE-04": "2026-11-16T13:00:00.000Z" }).unclear).toHaveLength(0);
  });
});

describe("repeated mistakes and claims", () => {
  it("counts by rule, channel and category", () => {
    const i = computeInsights([rec("TERM-01", [], { channel: "email" }), rec("TERM-01"), rec("TONE-04")], rules);
    expect(i.byRule[0]).toMatchObject({ count: 2, drafts: 2 });
    expect(i.byRule[0].rule.code).toBe("TERM-01");
    expect(Object.fromEntries(i.byCategory)).toEqual({ terminology: 2, tone: 1 });
  });
  it("groups unsupported claims, and repeated conflicts with one fact", () => {
    const recs = [
      rec("CLAIM-01", [], { quote: "stocked in 40+ offices" }), rec("CLAIM-01", [], { quote: "Stocked in 40+ offices" }),
      rec("CLAIM-01", [], { quote: "50,000+ customers", fact_code: "F-12" }), rec("CLAIM-01", [], { quote: "50,000+ customers", fact_code: "F-12" }),
      rec("CLAIM-01", [], { quote: "₹499", fact_code: "F-15" }),
    ];
    const m = computeInsights(recs, rules).missingFacts;
    expect(m.map((g) => [g.kind, g.count])).toEqual([["unsupported", 2], ["conflicting", 2]]);
    expect(m[1].prefill).toMatchObject({ value: 50000, unit: "count" });
  });
});

describe("decisions as test cases", () => {
  it("accepted or upheld means flag, overridden means pass, open is not a case", () => {
    const recs = [rec("TONE-04", [{ action: "accept", by: "Arjun", at: "x" }]), rec("TONE-04", [dispute, override]), rec("TONE-04")];
    const t = computeInsights(recs, rules).testCases[0];
    expect([t.shouldFlag.length, t.shouldPass.length]).toEqual([1, 1]);
    expect(testCasesJSON([t]).map((c) => c.expected)).toEqual(["flag", "pass"]);
  });
});

describe("real records", () => {
  it("merges a finding re-stored on every re-check and keeps its decisions", () => {
    const f = (id: string, at: string) => ({ id, draft_id: "d1", rule_code: "TONE-04", field: "body", quote: "Hurry", message: "m", label: "code", fact_code: null, created_at: at });
    const recs = realRecords(
      [f("a", "2026-11-16T10:00:00Z"), f("b", "2026-11-16T10:05:00Z")],
      [{ finding_id: "b", action: "dispute", reason: "x", person_id: "p1", created_at: "2026-11-16T10:06:00Z" }],
      [{ id: "d1", title: "Post", channel: "instagram" }],
      new Map([["p1", "Arjun"]]),
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].decisions[0]).toMatchObject({ action: "dispute", by: "Arjun" });
  });
});
