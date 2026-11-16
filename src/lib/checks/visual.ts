// VIS-02: large areas of colour must come from the brand palette. Pure: takes colour shares, not an image.
import type { CheckContext, FindingDraft, Rule } from "./types";
import { deltaE, hexToRgb, rgbToHex, saturation, type ColorShare } from "./color";

export function paletteCheck(colors: ColorShare[], ctx: CheckContext, rule: Rule): FindingDraft[] {
  const maxDelta = Number(rule.params.max_delta_e ?? 12);
  const minShare = Number(rule.params.min_share ?? 0.08);
  if (!ctx.palette.length || !colors.length) return [];
  // The rule is about large flat areas in designed graphics. In a photograph no single colour
  // dominates, and natural colours (sky, skin, food) are not expected to match the palette.
  if (isPhotograph(colors)) return [];
  const palette = ctx.palette.map((p) => ({ ...p, rgb: hexToRgb(p.hex) }));
  const out: FindingDraft[] = [];
  for (const c of colors) {
    if (c.share < minShare || saturation(c.rgb) < 0.25) continue; // neutrals (white, black, greys) are always allowed
    const nearest = palette.map((p) => ({ ...p, d: deltaE(c.rgb, p.rgb) })).sort((a, b) => a.d - b.d)[0];
    if (nearest.d <= maxDelta) continue;
    const hex = rgbToHex(c.rgb);
    out.push({
      category: rule.category, severity: rule.severity, rule_code: rule.code, field: "image",
      quote: `Colour ${hex} covers ${Math.round(c.share * 100)}% of the image`,
      start: null, end: null,
      message: `${hex} is not a brand colour. The nearest brand colour is ${nearest.name} ${nearest.hex} (colour difference ${nearest.d.toFixed(0)}; up to ${maxDelta} counts as a match).`,
      fix_kind: "none",
      fix_text: `Use ${nearest.name} ${nearest.hex} for this area.`,
      label: "code",
    });
  }
  return out;
}

/** A designed graphic has at least one large flat area of colour; a photograph does not. */
export function isPhotograph(colors: ColorShare[]): boolean {
  return (colors[0]?.share ?? 0) < 0.25;
}
