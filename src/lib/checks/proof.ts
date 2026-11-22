// The proof check: an AI finding reaches a person only if code can verify its evidence.
//  1. The cited rule exists, is approved, applies to this channel and allows AI checking.
//  2. The quoted text really exists in the draft (exact, or after normalising spaces, quotes and case).
//  3. It is not a duplicate of something the code checks already found.
//  4. A suggested fix, once applied, does not break other rules (checked by running the code checks again).
import { runCodeChecks } from "./index";
import type { CheckContext, FindingDraft } from "./types";
import { ruleApplies } from "./types";
import { overlaps } from "./text";

export type AIFinding = { rule_code: string; quote: string; why: string; fix?: string | null; page?: number | null };
export type Dropped = { rule_code: string; quote: string; reason: string };

const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();

/** Finds `quote` in `text`, tolerating curly quotes, case and runs of whitespace. Returns exact positions. */
export function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const q = quote.trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact >= 0) return { start: exact, end: exact + q.length };
  // Build a normalised copy of the text with a map back to original positions.
  const map: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (flat.endsWith(" ")) continue;
      flat += " ";
    } else flat += norm(c);
    map.push(i);
  }
  const nq = norm(q).replace(/\s+/g, " ");
  const at = flat.indexOf(nq);
  if (at < 0) return null;
  return { start: map[at], end: map[at + nq.length - 1] + 1 };
}

export function proofCheck(ai: AIFinding[], ctx: CheckContext, codeFindings: FindingDraft[]): { kept: FindingDraft[]; dropped: Dropped[] } {
  const kept: FindingDraft[] = [];
  const dropped: Dropped[] = [];
  const countRules = (list: FindingDraft[]) => list.reduce((m, f) => m.set(f.rule_code, (m.get(f.rule_code) ?? 0) + 1), new Map<string, number>());
  const before = countRules(codeFindings);

  for (const a of ai) {
    const rule = ctx.rules.find((r) => r.code === a.rule_code);
    if (!rule || rule.status !== "approved") {
      dropped.push({ rule_code: a.rule_code, quote: a.quote, reason: "cites a rule that is not in the approved rulebook" });
      continue;
    }
    if (!ruleApplies(rule, ctx.channel) || rule.check_kind === "code") {
      dropped.push({ rule_code: a.rule_code, quote: a.quote, reason: "cites a rule that does not apply here" });
      continue;
    }
    if (!a.quote || a.quote.length > 400) {
      dropped.push({ rule_code: a.rule_code, quote: a.quote ?? "", reason: "has no usable quote" });
      continue;
    }
    // In a document, look on the page the AI named first (the same words can appear on several pages).
    const named = ctx.pages?.find((p) => p.n === a.page);
    const onPage = named ? locateQuote(ctx.body.slice(named.start, named.end), a.quote) : null;
    const pos = onPage ? { start: named!.start + onPage.start, end: named!.start + onPage.end } : locateQuote(ctx.body, a.quote);
    if (!pos) {
      dropped.push({ rule_code: a.rule_code, quote: a.quote, reason: "quotes text that is not in the draft" });
      continue;
    }
    const span = { start: pos.start, end: pos.end };
    if (codeFindings.some((f) => f.field === "body" && overlaps(f, span))) {
      dropped.push({ rule_code: a.rule_code, quote: a.quote, reason: "overlaps an issue the code checks already found" });
      continue;
    }
    if (kept.some((f) => overlaps(f, span))) {
      dropped.push({ rule_code: a.rule_code, quote: a.quote, reason: "duplicates another AI finding" });
      continue;
    }

    const quote = ctx.body.slice(pos.start, pos.end);
    let fix_kind: FindingDraft["fix_kind"] = "none";
    let fix_text: string | null = a.fix?.trim() || null;
    if (fix_text && fix_text !== quote) {
      const fixed = ctx.body.slice(0, pos.start) + fix_text + ctx.body.slice(pos.end);
      const introduced = runCodeChecks({ ...ctx, body: fixed, pages: undefined }).filter((f) => !before.has(`${f.rule_code}|${f.quote}`) && f.quote.length && fixed.includes(f.quote) && !ctx.body.includes(f.quote));
      if (introduced.length) {
        fix_text = `Rewrite this part. The AI suggestion “${fix_text}” was withheld because it would break ${[...new Set(introduced.map((f) => f.rule_code))].join(", ")}.`;
      } else fix_kind = "replace";
    } else if (!fix_text) {
      fix_text = `Rewrite this part so it follows ${rule.code}: ${rule.statement}`;
    }

    kept.push({
      category: rule.category,
      severity: rule.severity,
      rule_code: rule.code,
      field: "body",
      quote,
      start: pos.start,
      end: pos.end,
      message: a.why.trim(),
      fix_kind,
      fix_text,
      label: "ai_verified",
    });
  }
  return { kept, dropped };
}
