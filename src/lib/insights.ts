// Insights from review history: repeated mistakes, rules that may be unclear, claims without a fact,
// and human decisions kept as test cases. Pure functions, so every number on the page is unit-tested.
import { extractNumberClaims } from "@/lib/checks/claims";
import type { Channel } from "@/lib/checks/types";
import { SAMPLE_HISTORY } from "@/lib/seed/history";

export type Decision = { action: "accept" | "edit" | "dispute" | "uphold" | "override"; reason?: string | null; by: string; at: string };
export type InsightRecord = {
  key: string; draft: string; draftTitle: string; channel: Channel; rule_code: string; quote: string; message: string;
  label: string; fact_code: string | null; at: string; sample: boolean; decisions: Decision[];
};
export type RuleInfo = { code: string; title: string; statement: string; category: string; check_kind: string };

/** A rule is flagged when people push back on it often enough that the wording, not the writers, is the likely problem. */
export const UNCLEAR = { minOverrides: 2, minDisputes: 3, minShare: 0.25 } as const;
const CLAIM_RULES = new Set(["CLAIM-01", "CLAIM-02", "ADV-01"]);

// ── Building records ──────────────────────────────────────────────────────

export function sampleRecords(): InsightRecord[] {
  return SAMPLE_HISTORY.map((h, i) => ({
    key: `sample-${i}`, draft: `sample:${h.draft}`, draftTitle: h.draft, channel: h.channel, rule_code: h.rule_code, quote: h.quote, message: h.message,
    label: h.label, fact_code: h.fact_code ?? null, at: `${h.on}T10:00:00.000Z`, sample: true,
    decisions: h.decisions.map((d) => ({ ...d, at: `${h.on}T12:00:00.000Z` })),
  }));
}

type FindingRow = { id: string; draft_id: string; rule_code: string; field: string; quote: string; message: string; label: string; fact_code: string | null; created_at: string };
type DecisionRow = { finding_id: string | null; action: Decision["action"]; reason: string | null; person_id: string | null; created_at: string };

/**
 * The same finding is stored again on every re-check of a draft, so findings are merged by
 * draft, rule, field and quote. Each merged record keeps every human decision made on any copy.
 */
export function realRecords(findings: FindingRow[], decisions: DecisionRow[], drafts: { id: string; title: string; channel: Channel }[], people: Map<string, string>): InsightRecord[] {
  const draftById = new Map(drafts.map((d) => [d.id, d]));
  const byKey = new Map<string, InsightRecord>();
  const keyOfFinding = new Map<string, string>();
  for (const f of [...findings].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const d = draftById.get(f.draft_id);
    if (!d) continue;
    const key = `${f.draft_id}|${f.rule_code}|${f.field}|${f.quote}`;
    keyOfFinding.set(f.id, key);
    if (!byKey.has(key)) {
      byKey.set(key, { key, draft: f.draft_id, draftTitle: d.title, channel: d.channel, rule_code: f.rule_code, quote: f.quote, message: f.message, label: f.label, fact_code: f.fact_code, at: f.created_at, sample: false, decisions: [] });
    }
  }
  for (const d of [...decisions].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const rec = d.finding_id ? byKey.get(keyOfFinding.get(d.finding_id) ?? "") : undefined;
    if (rec) rec.decisions.push({ action: d.action, reason: d.reason, by: people.get(d.person_id ?? "") ?? "Someone", at: d.created_at });
  }
  return [...byKey.values()];
}

// ── Insights ───────────────────────────────────────────────────────────────

const has = (r: InsightRecord, a: Decision["action"]) => r.decisions.some((d) => d.action === a);
const countBy = <T,>(items: T[], key: (t: T) => string) => items.reduce<Record<string, number>>((m, t) => ((m[key(t)] = (m[key(t)] ?? 0) + 1), m), {});
const normClaim = (q: string) => q.toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}%+#.,' ]/gu, " ").replace(/\s+/g, " ").trim();

export type UnclearRule = {
  rule: RuleInfo; total: number; disputed: number; overridden: number; upheld: number; flagged: boolean; why: string;
  evidence: InsightRecord[]; sampleOnly: boolean;
};
export type ClaimGroup = { claim: string; kind: "unsupported" | "conflicting"; fact_code: string | null; count: number; drafts: number; channels: string[]; records: InsightRecord[]; prefill: { statement: string; value?: number; unit?: string } };
export type TestCases = { rule: RuleInfo; shouldFlag: InsightRecord[]; shouldPass: InsightRecord[] };

export function computeInsights(records: InsightRecord[], rules: RuleInfo[], reviewedAt: Record<string, string> = {}) {
  const ruleBy = new Map(rules.map((r) => [r.code, r]));
  const known = records.filter((r) => ruleBy.has(r.rule_code));

  // Repeated mistakes
  const byRule = Object.entries(countBy(known, (r) => r.rule_code))
    .map(([code, count]) => {
      const recs = known.filter((r) => r.rule_code === code);
      return { rule: ruleBy.get(code)!, count, drafts: new Set(recs.map((r) => r.draft)).size, channels: countBy(recs, (r) => r.channel), yours: recs.filter((r) => !r.sample).length };
    })
    .sort((a, b) => b.count - a.count || a.rule.code.localeCompare(b.rule.code));
  const byCategory = Object.entries(countBy(known, (r) => ruleBy.get(r.rule_code)!.category)).sort((a, b) => b[1] - a[1]);
  const byChannel = Object.entries(countBy(known, (r) => r.channel))
    .map(([channel, count]) => ({ channel, count, drafts: new Set(known.filter((r) => r.channel === channel).map((r) => r.draft)).size }))
    .sort((a, b) => b.count - a.count);

  // Rules that may be unclear. Only records after the manager last reviewed the rule's wording count.
  const unclear: UnclearRule[] = [];
  for (const rule of rules) {
    const since = reviewedAt[rule.code];
    const recs = known.filter((r) => r.rule_code === rule.code && (!since || r.at > since || r.decisions.some((d) => d.at > since)));
    if (!recs.length) continue;
    const disputed = recs.filter((r) => has(r, "dispute")).length;
    const overridden = recs.filter((r) => has(r, "override")).length;
    const upheld = recs.filter((r) => has(r, "uphold")).length;
    if (!disputed && !overridden) continue;
    const share = Math.max(disputed, overridden) / recs.length;
    const flagged = (overridden >= UNCLEAR.minOverrides || disputed >= UNCLEAR.minDisputes) && share >= UNCLEAR.minShare;
    const evidence = recs.filter((r) => has(r, "dispute") || has(r, "override") || has(r, "uphold"));
    const why = `${disputed} of ${recs.length} finding${recs.length > 1 ? "s were" : " was"} disputed${overridden ? `, and reviewers overrode ${overridden}` : ""}${upheld ? `; ${upheld} upheld` : ""}.`;
    unclear.push({ rule, total: recs.length, disputed, overridden, upheld, flagged, why, evidence, sampleOnly: evidence.every((r) => r.sample) });
  }
  unclear.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.overridden - a.overridden || b.disputed - a.disputed);

  // Claims without a fact (unsupported), and claims that keep disagreeing with the same fact (maybe outdated)
  const groups = new Map<string, ClaimGroup>();
  for (const r of known.filter((x) => CLAIM_RULES.has(x.rule_code))) {
    const kind = r.fact_code ? "conflicting" : "unsupported";
    const claim = normClaim(r.quote);
    const k = `${kind}|${r.fact_code ?? ""}|${claim}`;
    if (!groups.has(k)) {
      const n = extractNumberClaims(r.quote)[0];
      groups.set(k, { claim: r.quote, kind, fact_code: r.fact_code, count: 0, drafts: 0, channels: [], records: [], prefill: { statement: r.quote, ...(n ? { value: n.value, unit: n.unit } : {}) } });
    }
    const g = groups.get(k)!;
    g.records.push(r);
    g.count++;
  }
  const missingFacts = [...groups.values()]
    .map((g) => ({ ...g, drafts: new Set(g.records.map((r) => r.draft)).size, channels: [...new Set(g.records.map((r) => r.channel))] }))
    .filter((g) => g.kind === "unsupported" || g.count >= 2)
    .sort((a, b) => b.count - a.count);

  // Every human decision is a labelled example: accepted or upheld means "should be flagged", overridden means "should pass".
  const testCases: TestCases[] = rules
    .map((rule) => {
      const recs = known.filter((r) => r.rule_code === rule.code);
      return {
        rule,
        shouldFlag: recs.filter((r) => !has(r, "override") && (has(r, "accept") || has(r, "uphold"))),
        shouldPass: recs.filter((r) => has(r, "override")),
      };
    })
    .filter((t) => t.shouldFlag.length + t.shouldPass.length > 0)
    .sort((a, b) => b.shouldFlag.length + b.shouldPass.length - (a.shouldFlag.length + a.shouldPass.length));

  return {
    totals: {
      findings: known.length,
      drafts: new Set(known.map((r) => r.draft)).size,
      yours: known.filter((r) => !r.sample).length,
      sample: known.filter((r) => r.sample).length,
      accepted: known.filter((r) => has(r, "accept")).length,
      overridden: known.filter((r) => has(r, "override")).length,
    },
    byRule, byCategory, byChannel, unclear, missingFacts, testCases,
  };
}

/** Test cases in a plain format another tool (or the scored test set) can replay. */
export function testCasesJSON(cases: TestCases[]) {
  return cases.flatMap((t) => [
    ...t.shouldFlag.map((r) => ({ rule: t.rule.code, channel: r.channel, text: r.quote, expected: "flag", decided_by: r.decisions.at(-1)?.by, reason: r.decisions.at(-1)?.reason ?? null, sample: r.sample })),
    ...t.shouldPass.map((r) => ({ rule: t.rule.code, channel: r.channel, text: r.quote, expected: "pass", decided_by: r.decisions.at(-1)?.by, reason: r.decisions.at(-1)?.reason ?? null, sample: r.sample })),
  ]);
}
