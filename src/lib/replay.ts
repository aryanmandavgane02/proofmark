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

/**
 * In plain words: does the new wording match people's past decisions better, as well, or worse than the current one?
 * Added after user tests in Round 3, where people could not tell from the numbers whether to publish.
 */
export function replayVerdict(sm: ReplaySummary): { tone: "better" | "same" | "worse" | "none"; text: string } {
  if (!sm.decided) return { tone: "none", text: "No one has decided these findings yet, so there is nothing to compare the wording with." };
  const of = (n: number) => `${n} of ${sm.decided}`;
  if (sm.agreeAfter > sm.agreeBefore) return { tone: "better", text: `The new wording matches people's past decisions better: it agrees with ${of(sm.agreeAfter)}, the current wording with ${of(sm.agreeBefore)}.` };
  if (sm.agreeAfter < sm.agreeBefore) return { tone: "worse", text: `Careful, the new wording matches people's past decisions less well: it agrees with ${of(sm.agreeAfter)}, the current wording with ${of(sm.agreeBefore)}.` };
  return { tone: "same", text: `The new wording matches people's past decisions as well as the current one: ${of(sm.agreeAfter)} either way.` };
}

/** One past finding as a sentence: what people decided, and what each wording does with it. */
export function replayExample(r: ReplayRow): string {
  const who = r.decidedBy ?? "A reviewer";
  const quote = r.quote.length > 80 ? `${r.quote.slice(0, 80)}…` : r.quote;
  const people = r.human === "pass" ? `${who} overrode it, so it should pass` : r.human === "flag" ? `${who} agreed it was a problem` : "no one has decided it yet";
  const does = (v: Verdict) => (v === "flag" ? "flags" : "passes");
  const agrees = !r.human ? "" : r.after === r.human ? `, as ${who} decided` : `, although ${who} decided otherwise`;
  return `“${quote}” (${r.title}): ${people}. The current wording ${does(r.before)} it; the new wording ${does(r.after)} it${agrees}.`;
}
