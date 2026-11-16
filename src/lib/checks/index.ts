// Runs every code check that applies to the draft's channel. No AI involved: same input, same output.
import type { CheckContext, FindingDraft, Rule } from "./types";
import { ruleApplies } from "./types";
import { allCapsCheck, emojiCheck, glossaryCheck, hashtagCheck, pressureCheck, readabilityCheck } from "./style";
import { absolutesCheck, disclaimerCheck, factsCheck, healthClaimsCheck, superlativesCheck } from "./claims";
import { altTextCheck } from "./accessibility";

type CheckFn = (ctx: CheckContext, rule: Rule) => FindingDraft[];

export const CODE_CHECKS: Record<string, CheckFn> = {
  glossary: glossaryCheck,
  readability: readabilityCheck,
  all_caps: allCapsCheck,
  pressure: pressureCheck,
  hashtags: hashtagCheck,
  emoji: emojiCheck,
  facts: factsCheck,
  superlatives: superlativesCheck,
  health_claims: healthClaimsCheck,
  absolutes: absolutesCheck,
  disclaimer: disclaimerCheck,
  alt_text: altTextCheck,
};

const SEVERITY_RANK = { blocker: 0, major: 1, minor: 2 } as const;

export function runCodeChecks(ctx: CheckContext): FindingDraft[] {
  const out: FindingDraft[] = [];
  for (const rule of ctx.rules) {
    if (!ruleApplies(rule, ctx.channel) || rule.check_kind === "ai" || !rule.check_type) continue;
    const fn = CODE_CHECKS[rule.check_type];
    if (fn) out.push(...fn(ctx, rule));
  }
  return sortFindings(dedupe(out));
}

/** Removes exact duplicates (same rule, same span). */
export function dedupe(findings: FindingDraft[]): FindingDraft[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.rule_code}|${f.field}|${f.start}|${f.end}|${f.quote}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sortFindings(findings: FindingDraft[]): FindingDraft[] {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.start ?? 1e9) - (b.start ?? 1e9),
  );
}
