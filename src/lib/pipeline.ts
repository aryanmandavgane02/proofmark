import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCodeChecks } from "@/lib/checks";
import type { Channel, CheckContext, Fact, FindingDraft, PaletteColor, Rule, Term } from "@/lib/checks/types";

export function fingerprint(v: { body: string; alt_text: string; image_path: string | null; channel: string }): string {
  return createHash("sha256").update(JSON.stringify([v.channel, v.body, v.alt_text, v.image_path ?? ""])).digest("hex").slice(0, 32);
}

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Loads the approved rulebook and brand data the visitor is allowed to see (row-level security applies). */
export async function loadBrand(db: SupabaseClient, workspaceId: string) {
  const [rules, facts, terms, assets] = await Promise.all([
    db.from("rules").select("*").eq("workspace_id", workspaceId).eq("status", "approved"),
    db.from("facts").select("*").eq("workspace_id", workspaceId),
    db.from("terms").select("*").eq("workspace_id", workspaceId),
    db.from("assets").select("*").eq("workspace_id", workspaceId).eq("kind", "color"),
  ]);
  return {
    rules: (rules.data ?? []) as Rule[],
    facts: (facts.data ?? []).map((f) => ({ ...f, value: f.value == null ? null : Number(f.value) })) as Fact[],
    terms: (terms.data ?? []) as Term[],
    palette: (assets.data ?? []).map((a) => ({ name: a.name, hex: a.hex })) as PaletteColor[],
  };
}

type VersionRow = { id: string; draft_id: string; version: number; body: string; alt_text: string; image_path: string | null };

/**
 * Runs every check on one draft version and stores the run and its findings.
 * Decisions already made on the same issue in an earlier version (disputed, overridden, upheld) carry over.
 */
export async function runChecks(db: SupabaseClient, input: { workspaceId: string; rulebookVersion: number; channel: Channel; version: VersionRow }) {
  const started = Date.now();
  const brand = await loadBrand(db, input.workspaceId);
  const ctx: CheckContext = {
    body: input.version.body,
    alt_text: input.version.alt_text,
    channel: input.channel,
    hasImage: !!input.version.image_path,
    ...brand,
    today: todayIST(),
  };

  const findings: FindingDraft[] = runCodeChecks(ctx);
  const fp = fingerprint({ ...input.version, channel: input.channel });

  const { data: run, error } = await db
    .from("check_runs")
    .insert({
      workspace_id: input.workspaceId,
      draft_version_id: input.version.id,
      rulebook_version: input.rulebookVersion,
      fingerprint: fp,
      ms: Date.now() - started,
      ai_status: "skipped",
      ai_requests: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save the check run: ${error.message}`);

  // Carry earlier human decisions forward when the same issue is found again.
  const { data: previous } = await db
    .from("findings")
    .select("rule_code, quote, field, status")
    .eq("draft_id", input.version.draft_id)
    .in("status", ["disputed", "overridden", "upheld"]);
  const carried = new Map((previous ?? []).map((p) => [`${p.rule_code}|${p.field}|${p.quote}`, p.status as string]));

  if (findings.length) {
    const rows = findings.map((f) => ({
      workspace_id: input.workspaceId,
      draft_id: input.version.draft_id,
      draft_version_id: input.version.id,
      check_run_id: run.id,
      category: f.category,
      severity: f.severity,
      rule_code: f.rule_code,
      fact_code: f.fact_code ?? null,
      field: f.field,
      quote: f.quote,
      start_at: f.start,
      end_at: f.end,
      message: f.message,
      fix_kind: f.fix_kind,
      fix_text: f.fix_text,
      label: f.label,
      status: carried.get(`${f.rule_code}|${f.field}|${f.quote}`) ?? "open",
    }));
    const { error: fe } = await db.from("findings").insert(rows);
    if (fe) throw new Error(`Could not save findings: ${fe.message}`);
  }
  return { runId: run.id as string, count: findings.length, fingerprint: fp };
}
