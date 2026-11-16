"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/gemini";
import { AIUnavailableError } from "@/lib/ai/provider";
import { proposeClearerRule, type ClarifyEvidence } from "@/lib/ai/clarify";
import { loadInsights } from "@/lib/insights-data";
import { publishApprovedRules } from "@/lib/rulebook";

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
  const provider = getProvider();
  if (!provider || s.workspace.code_checks_only) back(view, code, "AI is off here. You can still write clearer wording yourself below.");
  const evidence: ClarifyEvidence[] = u.evidence.map((r) => {
    const last = r.decisions.at(-1)!;
    const outcome = r.decisions.some((d) => d.action === "override") ? "overridden" : r.decisions.some((d) => d.action === "uphold") ? "upheld" : "disputed";
    return { quote: r.quote, channel: r.channel, outcome, reason: [...r.decisions].reverse().find((d) => d.reason)?.reason ?? last.reason ?? null };
  });
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

/** Saves the (possibly edited) clearer wording and publishes it as a new rulebook version straight away. */
export async function acceptWording(formData: FormData) {
  const view = String(formData.get("view") ?? "");
  const code = String(formData.get("rule_code") ?? "");
  const s = await managerSession();
  if (!s) back(view, code, "Only the brand manager can change rules.");
  const statement = String(formData.get("statement") ?? "").trim().replace(/\s+/g, " ").slice(0, 400);
  if (statement.length < 10) back(view, code, "The rule needs at least a short sentence.");
  const { data: rule } = await s.supabase.from("rules").select("statement").eq("workspace_id", s.workspace.id).eq("code", code).eq("status", "approved").maybeSingle();
  if (!rule) back(view, code, "That rule is not in the approved rulebook.");
  const { error } = await s.supabase.from("rules").update({ statement, updated_at: new Date().toISOString() }).eq("workspace_id", s.workspace.id).eq("code", code);
  if (error) back(view, code, error.message);
  const why = String(formData.get("why") ?? "").slice(0, 120);
  const version = await publishApprovedRules(s, `Clarified ${code}${why ? ` after ${why}` : ""}`);
  const now = new Date().toISOString();
  const db = createAdminClient();
  const proposalId = String(formData.get("proposal_id") ?? "");
  const decided = { status: "accepted", statement, decided_by: s.person.id, decided_at: now, published_version: version };
  const { data: updated } = proposalId
    ? await db.from("rule_proposals").update(decided).eq("id", proposalId).eq("workspace_id", s.workspace.id).eq("status", "proposed").select("id")
    : { data: [] };
  if (!updated?.length) {
    await db.from("rule_proposals").insert({ workspace_id: s.workspace.id, rule_code: code, old_statement: rule.statement, person_id: s.person.id, rationale: "Written by the brand manager.", ...decided });
  }
  await event(s.workspace.id, s.person.id, "rule.clarified", { code, version, from: rule.statement, to: statement });
  revalidatePath("/app", "layout");
  back(view, code, `Published rulebook v${version} with the clearer wording for ${code}. New checks use it from now on.`);
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
