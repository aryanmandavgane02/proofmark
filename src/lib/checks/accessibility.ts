// Code checks for accessibility.
import type { CheckContext, FindingDraft, Rule } from "./types";

const VISUAL_CHANNELS = new Set(["instagram", "ad"]);

/** A11Y-01: images need useful alt text. */
export function altTextCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const needsImage = ctx.hasImage || VISUAL_CHANNELS.has(ctx.channel);
  if (!needsImage) return [];
  const alt = ctx.alt_text.trim();
  const min = Number(rule.params.min ?? 10);
  const max = Number(rule.params.max ?? 150);
  const base = { category: rule.category, severity: rule.severity, rule_code: rule.code, field: "alt_text" as const, label: "code" as const };
  if (!alt) {
    return [{
      ...base, severity: "major", quote: "(no alt text)", start: null, end: null,
      message: "The image has no alt text, so people using screen readers miss it entirely.",
      fix_kind: "none",
      fix_text: "Describe what the image shows in one sentence, including any text in it, for example the offer.",
    }];
  }
  if (/^(image|picture|photo) of\b/i.test(alt)) {
    return [{
      ...base, severity: "minor", quote: alt, start: 0, end: alt.length,
      message: "Alt text should not start with “image of”; screen readers already announce that it is an image.",
      fix_kind: "set_alt", fix_text: alt.replace(/^(image|picture|photo) of\s*/i, "").replace(/^./, (c) => c.toUpperCase()),
    }];
  }
  if (alt.length < min || alt.length > max) {
    return [{
      ...base, severity: "minor", quote: alt, start: 0, end: alt.length,
      message: alt.length < min ? `Alt text is only ${alt.length} characters; it may not describe the image.` : `Alt text is ${alt.length} characters; keep it under ${max} so it is quick to hear.`,
      fix_kind: "none", fix_text: "Describe the main subject and any text in the image in one short sentence.",
    }];
  }
  return [];
}
