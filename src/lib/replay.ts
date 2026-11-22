// Rule-change replay (Round 3, improvement 3). Before new wording for an AI-checked rule is published, every past
// decision on that rule is judged again under the current wording and under the new wording, and both are compared
// with what people decided. Pure: the AI's verdicts come in as data, so every number here is unit-tested.
import type { InsightRecord } from "./insights";

export type Verdict = "flag" | "pass";
/** A past finding on the rule, with what people decided: flag (accepted or upheld), pass (overridden) or no verdict yet. */
export type ReplayCase = {
  key: string; quote: string; channel: string; title: string; sample: boolean;
  human: Verdict | null; decidedBy: string | null; reason: string | null;
};
export type Judged = { flag: boolean; reason: string };
export type ReplayRow = ReplayCase & { before: Verdict; after: Verdict; change: "now_pass" | "now_flag" | "same"; whyBefore: string; whyAfter: string };
export type ReplaySummary = { cases: number; decided: number; changed: number; nowPass: number; nowFlag: number; agreeBefore: number; agreeAfter: number };

const has = (r: InsightRecord, a: string) => r.decisions.some((d) => d.action === a);

/** The cases to replay: every past finding on the rule that a person acted on, with the human verdict if there is one. */
export function replayCases(records: InsightRecord[], ruleCode: string): ReplayCase[] {
  return records
    .filter((r) => r.rule_code === ruleCode && r.decisions.length > 0)
    .map((r) => {
      const human: Verdict | null = has(r, "override") ? "pass" : has(r, "uphold") || has(r, "accept") ? "flag" : null;
      const deciding = [...r.decisions].reverse().find((d) => d.action === "override" || d.action === "uphold" || d.action === "accept") ?? r.decisions.at(-1)!;
      const reason = [...r.decisions].reverse().find((d) => d.reason)?.reason ?? null;
      return { key: r.key, quote: r.quote, channel: r.channel, title: r.draftTitle, sample: r.sample, human, decidedBy: human ? deciding.by : null, reason };
    })
    .sort((a, b) => Number(a.human === null) - Number(b.human === null) || a.title.localeCompare(b.title));
}

/** One row per case: the verdict under each wording and what would change. A case the AI left out counts as "pass". */
export function replayRows(cases: ReplayCase[], before: Judged[], after: Judged[]): ReplayRow[] {
  return cases.map((c, i) => {
    const b: Verdict = before[i]?.flag ? "flag" : "pass";
    const a: Verdict = after[i]?.flag ? "flag" : "pass";
    return {
      ...c, before: b, after: a,
      change: b === a ? "same" : a === "pass" ? "now_pass" : "now_flag",
      whyBefore: before[i]?.reason ?? "No answer for this case.", whyAfter: after[i]?.reason ?? "No answer for this case.",
    };
  });
}

/** How many would change, and how often each wording agrees with the people who decided. */
export function summarize(rows: ReplayRow[]): ReplaySummary {
  const decided = rows.filter((r) => r.human);
  return {
    cases: rows.length,
    decided: decided.length,
    changed: rows.filter((r) => r.change !== "same").length,
    nowPass: rows.filter((r) => r.change === "now_pass").length,
    nowFlag: rows.filter((r) => r.change === "now_flag").length,
    agreeBefore: decided.filter((r) => r.before === r.human).length,
    agreeAfter: decided.filter((r) => r.after === r.human).length,
  };
}

/** "3 of 4 (75%)" */
export function agreement(n: number, of: number): string {
  return of ? `${n} of ${of} (${Math.round((n / of) * 100)}%)` : "no decided cases";
}
