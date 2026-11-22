"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/gemini";
import { AIUnavailableError } from "@/lib/ai/provider";
import { proposeClearerRule, type ClarifyEvidence } from "@/lib/ai/clarify";
import { loadInsights } from "@/lib/insights-data";
import { clarifyEvidence } from "@/lib/insights";
import { publishApprovedRules } from "@/lib/rulebook";
import { publishedRules } from "@/lib/pipeline";
import { notice } from "@/lib/notice";
import { attachReplays, replayLine, runReplay } from "@/lib/replay-server";

async function managerSession() {
  const s = await requireSession();
  return s.person.role === "manager" ? s : null;
}

function back(view: string, code: string, msg?: string): never {
  const q = new URLSearchParams();
  if (view === "mine") q.set("view", "mine");
  if (msg) q.set("msg", msg);
  redirect(`/app/insights${q.size ? `?${q}` : ""}#rule-${code}`);
}

async function event(workspaceId: string, personId: string, type: string, detail: Record<string, unknown>) {
  await createAdminClient().from("events").insert({ workspace_id: workspaceId, person_id: personId, type, detail });
}

/** Asks the AI for clearer wording, based on the decisions that made the rule look unclear. */
export async function proposeWording(formData: FormData) {
  const view = String(formData.get("view") ?? "");
  const code = String(formData.get("rule_code") ?? "");
  const s = await managerSession();
  if (!s) back(view, code, "Only the brand manager can change rules.");
  const { insights } = await loadInsights(s, view !== "mine");
  const u = insights.unclear.find((x) => x.rule.code === code);
  if (!u) back(view, code, "That rule has no disputes to learn from.");
  const { data: waiting } = await s.supabase.from("rule_proposals").select("id").eq("workspace_id", s.workspace.id).eq("rule_code", code).eq("status", "proposed").limit(1);
  if (waiting?.length) back(view, code, "A proposal for this rule is already waiting below. Accept it, edit it, or keep the current wording.");
  const provider = getProvider();
  if (!provider || s.workspace.code_checks_only) back(view, code, "AI is off here. You can still write clearer wording yourself below.");
  const evidence: ClarifyEvidence[] = clarifyEvidence(u);
  let result;
  try {
    result = await proposeClearerRule(provider, u.rule, evidence, s.workspace.id);
  } catch (e) {
    back(view, code, e instanceof AIUnavailableError ? e.message : "The AI could not propose wording just now. You can write it yourself below.");
  }
  await createAdminClient().from("rule_proposals").insert({
    workspace_id: s.workspace.id, rule_code: code, old_statement: u.rule.statement, statement: result.statement, rationale: result.rationale,
    evidence, ai_model: result.model, person_id: s.person.id,
  });
  await event(s.workspace.id, s.person.id, "rule.clarity_proposed", { code, disputed: u.disputed, overridden: u.overridden });
  revalidatePath("/app/insights");
  back(view, code);
}

const cleanStatement = (v: FormDataEntryValue | null) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 400);

/** Keeps the wording being considered on the open proposal (or opens one for the manager's own wording). */
async function keepProposal(s: NonNullable<Awaited<ReturnType<typeof managerSession>>>, code: string, oldStatement: string, statement: string, proposalId: string) {
  const db = createAdminClient();
  if (proposalId) {
    await db.from("rule_proposals").update({ statement }).eq("id", proposalId).eq("workspace_id", s.workspace.id).eq("status", "proposed");
    return;
  }
  const { data: open } = await db.from("rule_proposals").select("id").eq("workspace_id", s.workspace.id).eq("rule_code", code).eq("status", "proposed").limit(1);
  if (open?.length) await db.from("rule_proposals").update({ statement }).eq("id", open[0].id);
  else await db.from("rule_proposals").insert({ workspace_id: s.workspace.id, rule_code: code, old_statement: oldStatement, statement, rationale: "Written by the brand manager.", person_id: s.person.id });
}

/**
 * Rule-change replay, before publishing: judges every past decision on the rule under the live wording and the new
 * wording, and shows what would change. From Insights (a proposal) or from the Rulebook (an edited rule).
 */
export async function previewReplay(formData: FormData) {
  const view = String(formData.get("view") ?? "");
  const code = String(formData.get("rule_code") ?? "");
  const fromRulebook = formData.get("from") === "rulebook";
  function go(msg?: string, kind: "info" | "error" = "info"): never {
    return fromRulebook ? notice(`/app/rulebook#replay-${code}`, msg ?? `Replayed the new wording of ${code} against its past decisions.`, kind) : back(view, code, msg);
  }
  const s = await managerSession();
  if (!s) go("Only the brand manager can change rules.", "error");
  const statement = cleanStatement(formData.get("statement"));
  if (statement.length < 10) go("The rule needs at least a short sentence.", "error");
  const live = (await publishedRules(s.supabase, s.workspace.id)).rules.find((r) => r.code === code);
  if (!live) go("That rule is not in the published rulebook.", "error");
  if (!fromRulebook) await keepProposal(s, code, live.statement, statement, String(formData.get("proposal_id") ?? ""));
  const r = await runReplay(s, live, live.statement, statement);
  revalidatePath(fromRulebook ? "/app/rulebook" : "/app/insights");
  if ("error" in r) go(r.error, "error");
  go(fromRulebook ? `${code}: ${replayLine(r.replay.summary)}.` : undefined);
}

/**
 * Publishes clearer wording as a new rulebook version. The replay of exactly this wording must have been shown first:
 * if it has not, it runs now and the page shows it, and the manager publishes with a second click.
 */
export async function acceptWording(formData: FormData) {
  const view = String(formData.get("view") ?? "");
  const code = String(formData.get("rule_code") ?? "");
  const s = await managerSession();
  if (!s) back(view, code, "Only the brand manager can change rules.");
  const statement = cleanStatement(formData.get("statement"));
  if (statement.length < 10) back(view, code, "The rule needs at least a short sentence.");
  const { data: rule } = await s.supabase.from("rules").select("statement").eq("workspace_id", s.workspace.id).eq("code", code).eq("status", "approved").maybeSingle();
  if (!rule) back(view, code, "That rule is not in the approved rulebook.");
  if (rule.statement === statement) back(view, code, "This wording is already the rule's wording, so there is nothing to publish.");
  const proposalId = String(formData.get("proposal_id") ?? "");

  // The effect on past decisions is shown before anything is published.
  const live = (await publishedRules(s.supabase, s.workspace.id)).rules.find((r) => r.code === code);
  const replay = live ? await runReplay(s, live, live.statement, statement) : { error: "The rule is not in the published rulebook yet." };
  if (!("error" in replay) && replay.fresh) {
    await keepProposal(s, code, live!.statement, statement, proposalId);
    revalidatePath("/app/insights");
    back(view, code, "Before publishing: below is how this wording would change the past decisions on this rule. Publish again to confirm.");
  }
  const now = new Date().toISOString();
  const db = createAdminClient();
  // Claim the proposal first, so a double click or a second tab cannot publish it twice.
  if (proposalId) {
    const { data: claimed } = await db.from("rule_proposals").update({ status: "accepted", statement, decided_by: s.person.id, decided_at: now }).eq("id", proposalId).eq("workspace_id", s.workspace.id).eq("status", "proposed").select("id");
    if (!claimed?.length) back(view, code, "This proposal was already decided, maybe in another tab.");
  }
  const { error } = await s.supabase.from("rules").update({ statement, updated_at: now }).eq("workspace_id", s.workspace.id).eq("code", code);
  if (error) back(view, code, error.message);
  const why = String(formData.get("why") ?? "").slice(0, 120);
  const { version } = await publishApprovedRules(s, `Clarified ${code}${why ? ` after ${why}` : ""}`);
  if (!("error" in replay)) await attachReplays(s.workspace.id, [replay.replay.id], version);
  if (proposalId) await db.from("rule_proposals").update({ published_version: version }).eq("id", proposalId);
  else await db.from("rule_proposals").insert({ workspace_id: s.workspace.id, rule_code: code, old_statement: rule.statement, person_id: s.person.id, rationale: "Written by the brand manager.", status: "accepted", statement, decided_by: s.person.id, decided_at: now, published_version: version });
  await event(s.workspace.id, s.person.id, "rule.clarified", { code, version, from: rule.statement, to: statement });
  revalidatePath("/app", "layout");
  back(view, code, `Published rulebook v${version} with the clearer wording for ${code}. ${"error" in replay ? `Not replayed: ${replay.error}` : `Replay kept with v${version}: ${replayLine(replay.replay.summary)}.`} New checks use it from now on.`);
}

/** Keeps the current wording. Earlier pushback stops counting against the rule. */
export async function keepWording(formData: FormData) {
  const view = String(formData.get("view") ?? "");
  const code = String(formData.get("rule_code") ?? "");
  const s = await managerSession();
  if (!s) back(view, code, "Only the brand manager can change rules.");
  const { data: rule } = await s.supabase.from("rules").select("statement").eq("workspace_id", s.workspace.id).eq("code", code).maybeSingle();
  if (!rule) back(view, code);
  const now = new Date().toISOString();
  const db = createAdminClient();
  const { data: open } = await db.from("rule_proposals").update({ status: "dismissed", decided_by: s.person.id, decided_at: now }).eq("workspace_id", s.workspace.id).eq("rule_code", code).eq("status", "proposed").select("id");
  if (!open?.length) await db.from("rule_proposals").insert({ workspace_id: s.workspace.id, rule_code: code, old_statement: rule.statement, statement: rule.statement, rationale: "The brand manager kept the current wording.", status: "dismissed", decided_by: s.person.id, decided_at: now, person_id: s.person.id });
  await event(s.workspace.id, s.person.id, "rule.wording_kept", { code });
  revalidatePath("/app/insights");
  back(view, code, `Kept the wording of ${code}. It will be flagged again only if new pushback builds up.`);
}
