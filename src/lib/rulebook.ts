import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { requireSession } from "@/lib/session";

type Session = Awaited<ReturnType<typeof requireSession>>;

/** Publishes every approved rule as the next rulebook version. Callers must have checked the visitor is the brand manager. */
export async function publishApprovedRules(s: Session, note: string): Promise<number> {
  const { data: rules } = await s.supabase.from("rules").select("*").eq("workspace_id", s.workspace.id).eq("status", "approved").order("code");
  const { data: last } = await s.supabase.from("rulebook_versions").select("version").eq("workspace_id", s.workspace.id).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const snapshot = (rules ?? []).map((r) => ({
    code: r.code, category: r.category, title: r.title, statement: r.statement, severity: r.severity, channels: r.channels, check_kind: r.check_kind,
    check_type: r.check_type, params: r.params, source_doc: r.source_doc, source_page: r.source_page, source_quote: r.source_quote, builtin: r.builtin,
    status: r.status, examples: r.examples ?? [],
  }));
  const { error } = await s.supabase.from("rulebook_versions").insert({ workspace_id: s.workspace.id, version, note, published_by: s.person.id, snapshot });
  if (error) throw new Error(error.message);
  await s.supabase.from("workspaces").update({ rulebook_version: version }).eq("id", s.workspace.id);
  await createAdminClient().from("events").insert({ workspace_id: s.workspace.id, person_id: s.person.id, type: "rulebook.published", detail: { version, note } });
  return version;
}
