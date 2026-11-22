import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { requireSession } from "@/lib/session";

type Session = Awaited<ReturnType<typeof requireSession>>;

type RuleLike = { code: string; title: string; statement: string; severity: string; channels: string[]; params?: unknown };

/** What a rule looks like to the checker: changing any of these is a change worth publishing. */
export const ruleSignature = (r: RuleLike) => JSON.stringify([r.title, r.statement, r.severity, [...(r.channels ?? [])].sort(), r.params ?? {}]);

/** Approved rules that are new, edited or retired compared with the latest published version. */
export function pendingChanges(approved: RuleLike[], live: RuleLike[]) {
  const liveBy = new Map(live.map((r) => [r.code, r]));
  return {
    added: approved.filter((r) => !liveBy.has(r.code)).map((r) => r.code),
    changed: approved.filter((r) => liveBy.has(r.code) && ruleSignature(liveBy.get(r.code)!) !== ruleSignature(r)).map((r) => r.code),
    removed: live.filter((r) => !approved.some((a) => a.code === r.code)).map((r) => r.code),
  };
}

/**
 * Publishes every approved rule as the next rulebook version. Callers must have checked the visitor is the brand manager.
 * Two publishes at the same moment cannot create two versions: the second returns the version the first created.
 */
export async function publishApprovedRules(s: Session, note: string): Promise<{ version: number; already: boolean }> {
  const { data: rules } = await s.supabase.from("rules").select("*").eq("workspace_id", s.workspace.id).eq("status", "approved").order("code");
  const { data: last } = await s.supabase.from("rulebook_versions").select("version").eq("workspace_id", s.workspace.id).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const snapshot = (rules ?? []).map((r) => ({
    code: r.code, category: r.category, title: r.title, statement: r.statement, severity: r.severity, channels: r.channels, check_kind: r.check_kind,
    check_type: r.check_type, params: r.params, source_doc: r.source_doc, source_page: r.source_page, source_quote: r.source_quote, builtin: r.builtin,
    status: r.status, examples: r.examples ?? [],
  }));
  const { error } = await s.supabase.from("rulebook_versions").insert({ workspace_id: s.workspace.id, version, note, published_by: s.person.id, snapshot });
  if (error) {
    if (error.code === "23505") return { version, already: true };
    throw new Error(error.message);
  }
  await s.supabase.from("workspaces").update({ rulebook_version: version }).eq("id", s.workspace.id);
  await createAdminClient().from("events").insert({ workspace_id: s.workspace.id, person_id: s.person.id, type: "rulebook.published", detail: { version, note } });
  return { version, already: false };
}
