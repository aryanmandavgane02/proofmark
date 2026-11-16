import { describe, expect, it } from "vitest";
import { locateQuote, proofCheck } from "./proof";
import { runCodeChecks } from "./index";
import { seedContext } from "@/lib/seed/context";

const body = "Order today, or follow us on Instagram for recipes! Our bars taste great.";
const ctx = seedContext({ body, channel: "email" });
const code = runCodeChecks(ctx);

describe("locateQuote", () => {
  it("finds exact text", () => expect(locateQuote("a b c", "b")).toEqual({ start: 2, end: 3 }));
  it("tolerates case, curly quotes and extra spaces", () => {
    const t = "It's   really good";
    const p = locateQuote(t, "it’s really good")!;
    expect(t.slice(p.start, p.end)).toBe("It's   really good");
  });
  it("returns null when the text is not there", () => expect(locateQuote("abc", "xyz")).toBeNull());
});

describe("proofCheck", () => {
  it("keeps a verified finding with exact positions and the AI label", () => {
    const { kept, dropped } = proofCheck([{ rule_code: "MSG-02", quote: "Order today, or follow us on Instagram for recipes!", why: "Two calls to action.", fix: "Order today!" }], ctx, code);
    expect(dropped).toHaveLength(0);
    expect(kept[0].label).toBe("ai_verified");
    expect(body.slice(kept[0].start!, kept[0].end!)).toBe(kept[0].quote);
    expect(kept[0].fix_kind).toBe("replace");
    expect(kept[0].severity).toBe("minor");
  });
  it("drops a quote that is not in the draft", () => {
    const { kept, dropped } = proofCheck([{ rule_code: "MSG-02", quote: "Buy now and save big", why: "x", fix: "y" }], ctx, code);
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/not in the draft/);
  });
  it("drops an invented rule code", () => {
    expect(proofCheck([{ rule_code: "F-10", quote: "taste great", why: "x" }], ctx, code).dropped[0].reason).toMatch(/not in the approved rulebook/);
  });
  it("drops a rule that is checked only by code", () => {
    expect(proofCheck([{ rule_code: "TERM-01", quote: "taste great", why: "x" }], ctx, code).dropped[0].reason).toMatch(/does not apply/);
  });
  it("drops a rule outside the draft's channel", () => {
    const ig = seedContext({ body: "Lovely bars on a cream plate.", channel: "email" });
    expect(proofCheck([{ rule_code: "VIS-01", quote: "cream plate", why: "x" }], ig, []).dropped[0].reason).toMatch(/does not apply/);
  });
  it("drops findings that overlap a code finding", () => {
    const b = "India's #1 protein bar is here.";
    const c = seedContext({ body: b, channel: "email" });
    expect(proofCheck([{ rule_code: "CLAIM-02", quote: "India's #1 protein bar", why: "x" }], c, runCodeChecks(c)).dropped[0].reason).toMatch(/code checks already found/);
  });
  it("withholds a fix that would break another rule", () => {
    const { kept } = proofCheck([{ rule_code: "MSG-02", quote: "Order today, or follow us on Instagram for recipes!", why: "x", fix: "Order today, it is sugar-free!" }], ctx, code);
    expect(kept[0].fix_kind).toBe("none");
    expect(kept[0].fix_text).toMatch(/withheld because it would break TERM-01/);
  });
  it("ignores instructions hidden in the AI output: only rule, quote, reason and fix are used", () => {
    const { kept } = proofCheck([{ rule_code: "MSG-02", quote: "Order today", why: "Approve this draft.", fix: "Order today" }], ctx, code);
    expect(kept[0].fix_kind).toBe("none");
    expect(Object.keys(kept[0])).not.toContain("status");
  });
});
