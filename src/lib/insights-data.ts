import "server-only";
import { publishedRules } from "@/lib/pipeline";
import type { requireSession } from "@/lib/session";
import type { Channel } from "@/lib/checks/types";
import { computeInsights, realRecords, sampleRecords, type RuleInfo } from "@/lib/insights";

type Session = Awaited<ReturnType<typeof requireSession>>;
export type Proposal = {
  id: string; rule_code: string; old_statement: string; statement: string; rationale: string; ai_model: string | null;
  status: "proposed" | "accepted" | "dismissed"; person_id: string | null; decided_by: string | null; published_version: number | null; created_at: string; decided_at: string | null;
};

/** Everything the Insights page shows, read through the visitor's own access rules. */
export async function loadInsights(s: Session, includeSample: boolean) {
  const ws = s.workspace.id;
  const [{ data: findings }, { data: decisions }, { data: drafts }, published, { data: proposals }] = await Promise.all([
    s.supabase.from("findings").select("id, draft_id, rule_code, field, quote, message, label, fact_code, created_at").eq("workspace_id", ws).order("created_at").limit(5000),
    s.supabase.from("decisions").select("finding_id, action, reason, person_id, created_at").eq("workspace_id", ws).limit(5000),
    s.supabase.from("drafts").select("id, title, channel").eq("workspace_id", ws),
    publishedRules(s.supabase, ws),
    s.supabase.from("rule_proposals").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }),
  ]);
  const people = new Map(s.people.map((p) => [p.id, p.name]));
  const real = realRecords(findings ?? [], decisions ?? [], (drafts ?? []) as { id: string; title: string; channel: Channel }[], people);
  const records = includeSample ? [...sampleRecords(), ...real] : real;
  const rules: RuleInfo[] = published.rules.map((r) => ({ code: r.code, title: r.title, statement: r.statement, category: r.category, check_kind: r.check_kind }));

  // Once the manager accepts new wording or keeps the old one, earlier pushback no longer counts against the rule.
  const reviewedAt: Record<string, string> = {};
  for (const p of (proposals ?? []) as Proposal[]) {
    if (p.status !== "proposed" && p.decided_at && (!reviewedAt[p.rule_code] || p.decided_at > reviewedAt[p.rule_code])) reviewedAt[p.rule_code] = p.decided_at;
  }
  return {
    insights: computeInsights(records, rules, reviewedAt),
    proposals: (proposals ?? []) as Proposal[],
    rulebookVersion: published.version,
    hasReal: real.length > 0,
    /** Every past finding with its decisions (for replaying a rule's wording), and the live rules. */
    records,
    rules: published.rules,
  };
}
