import "server-only";
import type { requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/gemini";
import { AIUnavailableError, friendlyAIError } from "@/lib/ai/provider";
import { judgeCases } from "@/lib/ai/replay";
import { loadInsights } from "@/lib/insights-data";
import { replayCases, replayRows, summarize, type ReplayRow, type ReplaySummary } from "@/lib/replay";

type Session = Awaited<ReturnType<typeof requireSession>>;
export type StoredReplay = {
  id: string; rule_code: string; old_statement: string; new_statement: string; rows: ReplayRow[]; summary: ReplaySummary;
  ai_model: string | null; created_at: string; published_version: number | null;
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

/** The latest replay of exactly this change of wording, if its cases are still the rule's past decisions. */
export async function findReplay(s: Session, code: string, oldStatement: string, newStatement: string): Promise<StoredReplay | null> {
  const { data } = await s.supabase.from("rule_replays").select("*").eq("workspace_id", s.workspace.id).eq("rule_code", code)
    .eq("old_statement", norm(oldStatement)).eq("new_statement", norm(newStatement)).order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as StoredReplay | undefined) ?? null;
}

/**
 * Replays new wording for a rule against every past decision on it: one AI request per wording (stored by exact prompt),
 * compared with what people decided. Saved, so it can be shown before publishing and kept with the published version.
 */
export async function runReplay(
  s: Session, rule: { code: string; title: string; check_kind: string }, oldStatement: string, newStatement: string,
): Promise<{ replay: StoredReplay; fresh: boolean } | { error: string }> {
  if (rule.check_kind === "code") return { error: `${rule.code} is checked only by code, so its wording does not change what is flagged and there is nothing to replay.` };
  const before = norm(oldStatement);
  const after = norm(newStatement);
  if (before === after) return { error: "The new wording is the same as the current wording, so nothing would change." };
  const { records } = await loadInsights(s, true);
  const cases = replayCases(records, rule.code);
  if (!cases.length) return { error: `There are no past decisions on ${rule.code} yet, so there is nothing to replay.` };
  const existing = await findReplay(s, rule.code, before, after);
  if (existing && existing.rows.length === cases.length && existing.rows.every((r, i) => r.key === cases[i].key && r.human === cases[i].human)) {
    return { replay: existing, fresh: false };
  }
  const provider = getProvider();
  if (!provider || s.workspace.code_checks_only) return { error: "Replaying wording needs the AI, and AI checks are off here." };
  try {
    const deadline = Date.now() + 45_000;
    const [b, a] = await Promise.all([
      judgeCases(provider, rule, before, cases, s.workspace.id, deadline),
      judgeCases(provider, rule, after, cases, s.workspace.id, deadline),
    ]);
    const rows = replayRows(cases, b.judged, a.judged);
    const summary = summarize(rows);
    const { data, error } = await createAdminClient().from("rule_replays").insert({
      workspace_id: s.workspace.id, rule_code: rule.code, old_statement: before, new_statement: after, rows, summary, ai_model: a.model, created_by: s.person.id,
    }).select("*").single();
    if (error) return { error: `The replay could not be saved (${error.message}).` };
    await createAdminClient().from("events").insert({
      workspace_id: s.workspace.id, person_id: s.person.id, type: "rule.replayed",
      detail: { code: rule.code, cases: summary.cases, changed: summary.changed, agree_before: summary.agreeBefore, agree_after: summary.agreeAfter, decided: summary.decided },
    });
    return { replay: data as StoredReplay, fresh: true };
  } catch (e) {
    return { error: `The replay could not run: ${e instanceof AIUnavailableError ? e.message : friendlyAIError(e).message}` };
  }
}

/** Marks replays as published with a rulebook version. */
export async function attachReplays(workspaceId: string, ids: string[], version: number) {
  if (ids.length) await createAdminClient().from("rule_replays").update({ published_version: version }).eq("workspace_id", workspaceId).in("id", ids);
}

/** "2 of 4 past decisions would change; agreement with people 50% → 100%" */
export function replayLine(sm: ReplaySummary): string {
  const pct = (n: number) => (sm.decided ? `${Math.round((n / sm.decided) * 100)}%` : "n/a");
  return `${sm.changed} of ${sm.cases} past decision${sm.cases === 1 ? "" : "s"} would change (${sm.nowPass} now pass, ${sm.nowFlag} now flagged); agreement with people's decisions ${pct(sm.agreeBefore)} → ${pct(sm.agreeAfter)} (${sm.decided} decided)`;
}
