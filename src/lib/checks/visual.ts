// VIS-02: large areas of colour must come from the brand palette. Pure: takes colour shares, not an image.
// VIS-03: text in a document must be set in the brand typefaces.
import type { CheckContext, FindingDraft, Rule, Typeface } from "./types";
import { isSymbolFont, looksLikeHiddenName, sameFamily } from "@/lib/documents/fonts";
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

/** "Poppins (headlines) and Inter (body text)" */
export function typefaceList(typefaces: Typeface[]): string {
  const parts = typefaces.map((t) => (t.note ? `${t.name} (${t.note.toLowerCase()})` : t.name));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
}

/** A short excerpt of a run of text for the quote: its first line, cut at a word, at most about 100 characters. */
function excerpt(body: string, start: number, end: number): { start: number; end: number } {
  let s = start;
  while (s < end && /\s/.test(body[s])) s++;
  let e = body.indexOf("\n", s);
  e = e < 0 || e > end ? end : e;
  if (e - s > 100) {
    const cut = body.lastIndexOf(" ", s + 100);
    e = cut > s + 20 ? cut : s + 100;
  }
  while (e > s && /[\s,;:]/.test(body[e - 1])) e--;
  return { start: s, end: e };
}

/**
 * VIS-03: every font that sets words in a document must be one of the brand typefaces. One finding per page and font,
 * quoting the longest text set in it. Symbol and emoji fonts are ignored; so is the OCR layer of a scan.
 */
export function typefaceCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  if (!ctx.pages?.length || ctx.scanned || !ctx.typefaces.length) return [];
  const out: FindingDraft[] = [];
  for (const page of ctx.pages) {
    const off = new Map<string, { start: number; end: number; letters: number }[]>();
    for (const run of page.runs) {
      if (!run.family || isSymbolFont(run.family) || ctx.typefaces.some((t) => sameFamily(run.family, t.name))) continue;
      const letters = (ctx.body.slice(run.start, run.end).match(/[\p{L}\p{N}]/gu) ?? []).length;
      if (!letters) continue;
      off.set(run.family, [...(off.get(run.family) ?? []), { start: run.start, end: run.end, letters }]);
    }
    for (const [family, runs] of off) {
      const total = runs.reduce((n, r) => n + r.letters, 0);
      const longest = [...runs].sort((a, b) => b.letters - a.letters)[0];
      const q = excerpt(ctx.body, longest.start, longest.end);
      const quoted = (ctx.body.slice(q.start, q.end).match(/[\p{L}\p{N}]/gu) ?? []).length;
      const what = total > quoted ? `${total} letters, including this text, are` : "this text is";
      const hidden = looksLikeHiddenName(family);
      out.push({
        category: rule.category, severity: rule.severity, rule_code: rule.code, field: "document", page: page.n,
        quote: ctx.body.slice(q.start, q.end), start: q.start, end: q.end,
        message: hidden
          ? `On page ${page.n}, ${what} set in a font the PDF names “${family}”. That is a code, not a typeface name (some design tools hide font names), so check the font in the source file. The brand uses ${typefaceList(ctx.typefaces)}.`
          : `On page ${page.n}, ${what} set in ${family}, which is not a brand typeface. The brand uses ${typefaceList(ctx.typefaces)}.`,
        fix_kind: "none",
        fix_text: `Change the font to ${typefaceList(ctx.typefaces)} in the source file, export the PDF again and upload it as a new version.`,
        label: hidden ? "needs_judgment" : "code",
      });
    }
  }
  return out;
}
