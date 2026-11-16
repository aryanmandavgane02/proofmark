import { describe, expect, it } from "vitest";
import { attachAltSuggestion, imageAIFindings, imageTextFindings } from "./image-findings";
import { runCodeChecks } from "./index";
import { seedContext } from "@/lib/seed/context";

const ctx = seedContext({ body: "Celebrate Diwali with Urja Bites. T&C apply.", channel: "ad" });

describe("text read from an image", () => {
  const f = imageTextFindings("URJA bites\nINDIA'S #1 PROTEIN BAR\n50% OFF THIS DIWALI!!!", ctx);
  it("checks it against the same facts and rules", () => {
    const codes = f.map((x) => `${x.rule_code}${x.fact_code ? "/" + x.fact_code : ""}`);
    expect(codes).toEqual(expect.arrayContaining(["CLAIM-02", "CLAIM-01/F-13", "TONE-04"]));
  });
  it("reports words in capitals once, not per word", () => {
    expect(f.filter((x) => x.rule_code === "TONE-03")).toHaveLength(1);
  });
  it("marks every finding as about the image, with advice instead of an automatic fix", () => {
    for (const x of f) {
      expect(x.field).toBe("image");
      expect(x.fix_kind).toBe("none");
      expect(x.quote).toMatch(/^In the image/);
    }
  });
  it("returns nothing for an image without text", () => expect(imageTextFindings("  ", ctx)).toHaveLength(0));
});

describe("AI observations about the picture", () => {
  it("keeps approved visual rules and always asks a person to confirm", () => {
    const { kept } = imageAIFindings({ text_in_image: "", alt_text: "", findings: [{ rule_code: "VIS-01", evidence: "logo is blue", why: "recoloured", fix: "use the cream logo" }] }, ctx);
    expect(kept[0].label).toBe("needs_judgment");
    expect(kept[0].severity).toBe("major");
  });
  it("drops non-visual or invented rules and empty evidence", () => {
    const { kept, dropped } = imageAIFindings({ text_in_image: "", alt_text: "", findings: [
      { rule_code: "TONE-01", evidence: "x", why: "x", fix: "x" },
      { rule_code: "VIS-99", evidence: "x", why: "x", fix: "x" },
      { rule_code: "VIS-01", evidence: " ", why: "x", fix: "x" },
    ] }, ctx);
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(3);
  });
});

describe("alt text suggestion", () => {
  it("turns a missing-alt-text finding into an acceptable fix", () => {
    const f = runCodeChecks(ctx);
    attachAltSuggestion(f, "An orange ad for Urja Bites protein bars with 50% off text.");
    const a = f.find((x) => x.rule_code === "A11Y-01")!;
    expect(a.fix_kind).toBe("set_alt");
    expect(a.label).toBe("code");
  });
});
