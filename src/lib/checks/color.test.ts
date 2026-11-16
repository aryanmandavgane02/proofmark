import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE, dominantColors, hexToRgb, rgbToHex } from "./color";
import { paletteCheck } from "./visual";
import { seedContext, seedRules } from "@/lib/seed/context";

const rule = seedRules().find((r) => r.code === "VIS-02")!;
const ctx = seedContext({ body: "", channel: "ad" });

describe("colour maths", () => {
  it("round-trips hex", () => expect(rgbToHex(hexToRgb("#F4A300"))).toBe("#F4A300"));
  it("identical colours have zero difference", () => expect(deltaE([10, 20, 30], [10, 20, 30])).toBe(0));
  it("orange vs saffron is clearly different", () => expect(deltaE(hexToRgb("#F26A1B"), hexToRgb("#F4A300"))).toBeGreaterThan(12));
  it("computes WCAG contrast", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrastRatio(hexToRgb("#F7A24A"), hexToRgb("#F26A1B"))).toBeLessThan(4.5);
  });
  it("finds dominant colours and their shares", () => {
    const px = new Uint8Array(100 * 3);
    for (let i = 0; i < 100; i++) px.set(i < 75 ? [242, 106, 27] : [255, 255, 255], i * 3);
    const d = dominantColors(px);
    expect(d[0].share).toBeCloseTo(0.75, 2);
    expect(rgbToHex(d[0].rgb)).toBe("#F26A1B");
  });
});

describe("VIS-02 palette check", () => {
  it("flags a large off-palette colour and names the nearest brand colour", () => {
    const [f] = paletteCheck([{ rgb: hexToRgb("#F26A1B"), share: 0.6 }], ctx, rule);
    expect(f.field).toBe("image");
    expect(f.fix_text).toMatch(/Saffron #F4A300/);
  });
  it("accepts brand colours, neutrals and small areas", () => {
    expect(paletteCheck([{ rgb: hexToRgb("#F4A300"), share: 0.6 }, { rgb: [255, 255, 255], share: 0.3 }, { rgb: hexToRgb("#1E88E5"), share: 0.02 }], ctx, rule)).toHaveLength(0);
  });
});
