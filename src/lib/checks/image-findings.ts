// Turns the AI's image review into findings. Two parts:
//  - Text the AI reads inside the image is checked by the same code checks as the caption,
//    so a "50% off" or "#1" baked into a picture is caught with the same rules and facts.
//  - AI observations about the picture (logo use, readability) cannot be verified by code,
//    so they always carry the label "needs human judgment".
import { runCodeChecks } from "./index";
import type { CheckContext, FindingDraft } from "./types";
import { ruleApplies } from "./types";
import type { Dropped } from "./proof";

export type ImageReview = {
  text_in_image: string;
  alt_text: string;
  findings: { rule_code: string; evidence: string; why: string; fix: string }[];
};

const NOT_FOR_IMAGE_TEXT = new Set(["hashtags", "emoji", "readability", "alt_text", "disclaimer"]);

export function imageTextFindings(text: string, ctx: CheckContext): FindingDraft[] {
  const t = text.trim();
  if (!t) return [];
  const rules = ctx.rules.filter((r) => !NOT_FOR_IMAGE_TEXT.has(r.check_type ?? ""));
  const raw = runCodeChecks({ ...ctx, body: t, rules });
  // Headline text in images is often set in capitals: report that once, not once per word.
  const caps = raw.filter((f) => f.rule_code === "TONE-03");
  const rest = raw.filter((f) => f.rule_code !== "TONE-03");
  if (caps.length > 1) {
    rest.push({
      ...caps[0],
      quote: caps.map((f) => f.quote).join(", "),
      message: `${caps.length} words are written in capitals (${caps.map((f) => f.quote).join(", ")}), which reads as shouting.`,
      fix_kind: "none",
      fix_text: "Set the headline in sentence case, for example \u201cThe protein bar 35,000+ customers trust\u201d.",
    });
  } else rest.push(...caps);
  return rest.map((f) => ({
    ...f,
    field: "image" as const,
    start: null,
    end: null,
    quote: `In the image: “${f.quote}”`,
    fix_kind: "none" as const,
    fix_text: f.fix_kind === "replace" && f.fix_text ? `Change the text in the image to “${f.fix_text}”.` : f.fix_text,
  }));
}

export function imageAIFindings(review: ImageReview, ctx: CheckContext): { kept: FindingDraft[]; dropped: Dropped[] } {
  const kept: FindingDraft[] = [];
  const dropped: Dropped[] = [];
  for (const a of review.findings ?? []) {
    const rule = ctx.rules.find((r) => r.code === a.rule_code);
    if (!rule || rule.status !== "approved" || !ruleApplies(rule, ctx.channel) || rule.check_kind === "code" || !["visual", "accessibility"].includes(rule.category)) {
      dropped.push({ rule_code: a.rule_code, quote: a.evidence, reason: "cites a rule that is not an approved visual rule for this channel" });
      continue;
    }
    if (!a.evidence?.trim()) {
      dropped.push({ rule_code: a.rule_code, quote: "", reason: "gives no evidence" });
      continue;
    }
    kept.push({
      category: rule.category, severity: rule.severity, rule_code: rule.code, field: "image",
      quote: `In the image: ${a.evidence.trim()}`, start: null, end: null,
      message: a.why.trim(), fix_kind: "none", fix_text: a.fix?.trim() || `Change the image so it follows ${rule.code}: ${rule.statement}`,
      label: "needs_judgment",
    });
  }
  return { kept, dropped };
}

/** Adds the AI's suggested alt text to a missing-alt-text finding (the finding itself stays code-verified). */
export function attachAltSuggestion(findings: FindingDraft[], suggestion: string) {
  const s = suggestion.trim();
  if (!s) return;
  for (const f of findings) {
    if (f.rule_code === "A11Y-01" && f.field === "alt_text" && f.fix_kind === "none") {
      f.fix_kind = "set_alt";
      f.fix_text = s.slice(0, 150);
      f.message += " The suggested description below was written by AI from the image: check it before accepting.";
    }
  }
}
