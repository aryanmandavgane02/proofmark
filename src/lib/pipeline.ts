import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCodeChecks, sortFindings } from "@/lib/checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { locateQuote, proofCheck, type Dropped } from "@/lib/checks/proof";
import { overlaps } from "@/lib/checks/text";
import { getProvider } from "@/lib/ai/gemini";
import { AIUnavailableError } from "@/lib/ai/provider";
import { reviewImage, reviewText, secondOpinion } from "@/lib/ai/review";
import { analyseImage, loadImage } from "@/lib/images";
import { paletteCheck } from "@/lib/checks/visual";
import { attachAltSuggestion, imageAIFindings, imageTextFindings } from "@/lib/checks/image-findings";
import { ruleApplies } from "@/lib/checks/types";
import { URJA_LOGO_PNG_BASE64 } from "@/lib/seed/logo-png";
import type { Channel, CheckContext, Fact, FindingDraft, PaletteColor, Rule, Term } from "@/lib/checks/types";

export function fingerprint(v: { body: string; alt_text: string; image_path: string | null; channel: string }): string {
  return createHash("sha256").update(JSON.stringify([v.channel, v.body, v.alt_text, v.image_path ?? ""])).digest("hex").slice(0, 32);
}

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Loads the approved rulebook and brand data the visitor is allowed to see (row-level security applies). */
/** The rules that are live: the latest published rulebook version (edits stay pending until published). */
export async function publishedRules(db: SupabaseClient, workspaceId: string): Promise<{ version: number; rules: Rule[] }> {
  const { data } = await db.from("rulebook_versions").select("version, snapshot").eq("workspace_id", workspaceId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (data) return { version: data.version, rules: (data.snapshot as Rule[]).filter((r) => r.status === "approved") };
  const { data: live } = await db.from("rules").select("*").eq("workspace_id", workspaceId).eq("status", "approved");
  return { version: 1, rules: (live ?? []) as Rule[] };
}

export async function loadBrand(db: SupabaseClient, workspaceId: string) {
  const [published, facts, terms, assets] = await Promise.all([
    publishedRules(db, workspaceId),
    db.from("facts").select("*").eq("workspace_id", workspaceId),
    db.from("terms").select("*").eq("workspace_id", workspaceId),
    db.from("assets").select("*").eq("workspace_id", workspaceId).eq("kind", "color"),
  ]);
  return {
    rules: published.rules,
    rulebookVersion: published.version,
    facts: (facts.data ?? []).map((f) => ({ ...f, value: f.value == null ? null : Number(f.value) })) as Fact[],
    terms: (terms.data ?? []) as Term[],
    palette: (assets.data ?? []).map((a) => ({ name: a.name, hex: a.hex })) as PaletteColor[],
  };
}

type VersionRow = { id: string; draft_id: string; version: number; body: string; alt_text: string; image_path: string | null };
type RunInput = { workspaceId: string; rulebookVersion: number; channel: Channel; version: VersionRow; codeChecksOnly?: boolean; reuseFrom?: { runId: string; version: number } };
export type RunResult = { runId: string; count: number; fingerprint: string; ai?: () => Promise<void> };

/** The whole AI step (text review, second opinion, image review, retries) must finish within this. */
export const AI_BUDGET_MS = 40_000;
/** A run still "running" after this long is treated as finished without AI (for example, the server stopped). */
export const AI_STALE_MS = 120_000;

type FindingRowInput = { workspaceId: string; draftId: string; versionId: string; runId: string; carried: Map<string, string> };

async function carriedStatuses(db: SupabaseClient, draftId: string): Promise<Map<string, string>> {
  // Carry earlier human decisions forward when the same issue is found again.
  const { data: previous } = await db.from("findings").select("rule_code, quote, field, status").eq("draft_id", draftId).in("status", ["disputed", "overridden", "upheld"]);
  return new Map((previous ?? []).map((p) => [`${p.rule_code}|${p.field}|${p.quote}`, p.status as string]));
}

async function insertFindings(findings: FindingDraft[], at: FindingRowInput) {
  if (!findings.length) return;
  const rows = findings.map((f) => ({
    workspace_id: at.workspaceId,
    draft_id: at.draftId,
    draft_version_id: at.versionId,
    check_run_id: at.runId,
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
    status: at.carried.get(`${f.rule_code}|${f.field}|${f.quote}`) ?? "open",
  }));
  const { error } = await createAdminClient().from("findings").insert(rows);
  if (error) throw new Error(`Could not save findings: ${error.message}`);
}

/**
 * Runs every check on one draft version and stores the run and its findings.
 * Code checks (and colours) are saved straight away. When the AI is needed, the run is saved as "running"
 * and `ai` is returned: the caller schedules it after the response (Next.js `after`), so the page shows
 * the code findings at once and the AI findings arrive a few seconds later.
 * Decisions already made on the same issue in an earlier version (disputed, overridden, upheld) carry over.
 */
export async function runChecks(db: SupabaseClient, input: RunInput): Promise<RunResult> {
  const started = Date.now();
  const { rulebookVersion, ...brand } = await loadBrand(db, input.workspaceId);
  const ctx: CheckContext = {
    body: input.version.body,
    alt_text: input.version.alt_text,
    channel: input.channel,
    hasImage: !!input.version.image_path,
    ...brand,
    today: todayIST(),
  };

  const codeFindings: FindingDraft[] = runCodeChecks(ctx);
  const fp = fingerprint({ ...input.version, channel: input.channel });

  // Image: colours are checked by code; everything else about the picture goes to the AI.
  let image: Awaited<ReturnType<typeof analyseImage>> | null = null;
  let imageError: string | null = null;
  if (input.version.image_path) {
    try {
      image = await analyseImage(await loadImage(input.version.image_path));
      const vis = brand.rules.find((r) => r.check_type === "palette" && ruleApplies(r, input.channel));
      if (vis) codeFindings.push(...paletteCheck(image.colors, ctx, vis));
    } catch (e) {
      imageError = e instanceof Error ? e.message : "The image could not be read.";
    }
  }

  // Only the changed parts are re-checked: after an accepted fix, AI findings whose text did not change
  // are carried over from the previous run instead of asking the AI again. Code re-checks everything.
  const reusedFindings: FindingDraft[] = [];
  let reused: { model: string | null; count: number; fromVersion: number } | null = null;
  if (input.reuseFrom && !input.codeChecksOnly) {
    const { data: prevRun } = await db.from("check_runs").select("ai_status, ai_model").eq("id", input.reuseFrom.runId).maybeSingle();
    if (prevRun && ["ok", "cached", "reused"].includes(prevRun.ai_status)) {
      const { data: prev } = await db.from("findings").select("*").eq("check_run_id", input.reuseFrom.runId);
      for (const f of prev ?? []) {
        if (f.label === "code") {
          if (f.rule_code === "A11Y-01" && f.fix_kind === "set_alt" && f.fix_text) {
            const now = codeFindings.find((c) => c.rule_code === "A11Y-01" && c.field === "alt_text" && c.fix_kind === "none");
            if (now) Object.assign(now, { fix_kind: "set_alt", fix_text: f.fix_text, message: f.message });
          }
          continue;
        }
        if (f.status === "accepted") continue;
        let start: number | null = null;
        let end: number | null = null;
        if (f.field === "body") {
          const pos = locateQuote(ctx.body, f.quote);
          if (!pos) continue; // its text changed, so this finding no longer applies as written
          if (codeFindings.some((c) => c.field === "body" && overlaps(c, pos))) continue;
          ({ start, end } = pos);
        }
        reusedFindings.push({
          category: f.category, severity: f.severity, rule_code: f.rule_code, fact_code: f.fact_code, field: f.field,
          quote: f.quote, start, end, message: f.message, fix_kind: f.fix_kind, fix_text: f.fix_text, label: f.label,
        });
      }
      reused = { model: prevRun.ai_model, count: reusedFindings.length, fromVersion: input.reuseFrom.version };
    }
  }

  const provider = getProvider();
  const needsAI = !reused && !input.codeChecksOnly && !!provider;
  const ai_status = reused ? "reused" : input.codeChecksOnly ? "off" : !provider ? "unavailable" : "running";
  let ai_error: string | null = !provider && !input.codeChecksOnly && !reused ? "No AI key is configured, so only code checks ran." : null;
  if (imageError && !needsAI) ai_error = ai_error ? `${ai_error} ${imageError}` : imageError;

  // Results are written by the server only (visitors can read but not write them).
  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("check_runs")
    .insert({
      workspace_id: input.workspaceId,
      draft_version_id: input.version.id,
      rulebook_version: rulebookVersion,
      fingerprint: fp,
      ms: Date.now() - started,
      ai_ms: needsAI ? null : ai_status === "off" ? null : 0,
      reused_count: reused?.count ?? 0,
      reused_from_version: reused?.fromVersion ?? null,
      ai_status,
      ai_requests: 0,
      ai_model: reused?.model ?? null,
      ai_error,
      dropped: [],
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save the check run: ${error.message}`);

  const at: FindingRowInput = { workspaceId: input.workspaceId, draftId: input.version.draft_id, versionId: input.version.id, runId: run.id, carried: await carriedStatuses(db, input.version.draft_id) };
  const first = sortFindings([...codeFindings, ...reusedFindings]);
  await insertFindings(first, at);
  const result: RunResult = { runId: run.id as string, count: first.length, fingerprint: fp };
  if (needsAI) result.ai = () => runAIStage({ provider: provider!, ctx, codeFindings, image, imageError, at, started });
  return result;
}

/** The AI half of a check: text review, proof check, second opinion and image review, within one time budget. */
async function runAIStage(p: {
  provider: NonNullable<ReturnType<typeof getProvider>>; ctx: CheckContext; codeFindings: FindingDraft[];
  image: Awaited<ReturnType<typeof analyseImage>> | null; imageError: string | null; at: FindingRowInput; started: number;
}) {
  const { provider, ctx, codeFindings, at } = p;
  const deadline = Date.now() + AI_BUDGET_MS;
  const aiStarted = Date.now();
  const admin = createAdminClient();
  let aiFindings: FindingDraft[] = [];
  let dropped: Dropped[] = [];
  let ai_status: "ok" | "cached" | "unavailable" = "ok";
  let ai_requests = 0;
  let ai_model: string | null = null;
  let ai_error: string | null = null;
  let imageError = p.imageError;
  let intent: unknown = null;
  let altSuggestion: FindingDraft | null = null;
  try {
    const text = await reviewText(provider, ctx, at.workspaceId, deadline);
    ai_requests += text.requests;
    ai_model = text.model;
    intent = text.review.intent;
    const proof = proofCheck(text.review.findings, ctx, codeFindings);
    dropped = proof.dropped;
    aiFindings = proof.kept;
    const judgment = aiFindings.filter((f) => f.category === "tone" || f.category === "messaging");
    if (judgment.length) {
      try {
        const second = await secondOpinion(provider, ctx, judgment, at.workspaceId, deadline);
        ai_requests += second.requests;
        judgment.forEach((f, i) => {
          const v = second.verdicts.find((x) => x.index === i);
          if (!v || !v.violates) f.label = "needs_judgment";
        });
      } catch {
        judgment.forEach((f) => (f.label = "needs_judgment"));
      }
    }
    if (p.image) {
      try {
        const img = await reviewImage(provider, ctx, { ...p.image.forAI, hash: p.image.hash }, { mimeType: "image/png", data: URJA_LOGO_PNG_BASE64 }, at.workspaceId, deadline);
        ai_requests += img.requests;
        const inText = imageTextFindings(img.review.text_in_image, ctx);
        const visual = imageAIFindings(img.review, ctx);
        aiFindings.push(...inText.map((f) => ({ ...f, label: "needs_judgment" as const, message: `${f.message} (The rule was checked by code; the text was read from the image by AI, so please confirm it.)` })), ...visual.kept);
        dropped.push(...visual.dropped);
        const altNeeded = codeFindings.filter((f) => f.rule_code === "A11Y-01" && f.field === "alt_text" && f.fix_kind === "none");
        attachAltSuggestion(altNeeded, img.review.alt_text);
        altSuggestion = altNeeded.find((f) => f.fix_kind === "set_alt") ?? null;
      } catch (e) {
        imageError = e instanceof AIUnavailableError ? e.message : "The AI could not review the image.";
      }
    }
    ai_status = text.cached && ai_requests === 0 ? "cached" : "ok";
  } catch (e) {
    ai_status = "unavailable";
    ai_error = e instanceof AIUnavailableError ? e.message : "The AI check failed, so only code checks ran.";
  }
  if (imageError) ai_error = ai_error ? `${ai_error} ${imageError}` : imageError;

  try {
    if (intent) await admin.from("draft_versions").update({ intent }).eq("id", at.versionId).eq("workspace_id", at.workspaceId).is("intent", null);
    await insertFindings(sortFindings(aiFindings), at);
    if (altSuggestion) {
      await admin.from("findings").update({ fix_kind: "set_alt", fix_text: altSuggestion.fix_text, message: altSuggestion.message })
        .eq("check_run_id", at.runId).eq("rule_code", "A11Y-01").eq("field", "alt_text").eq("fix_kind", "none");
    }
    await admin.from("check_runs").update({ ai_status, ai_requests, ai_model, ai_error, dropped, ai_ms: Date.now() - aiStarted, ms: Date.now() - p.started }).eq("id", at.runId);
  } catch (e) {
    // Never leave a run stuck on "running".
    await admin.from("check_runs").update({ ai_status: "unavailable", ai_error: `The AI findings could not be saved (${e instanceof Error ? e.message.slice(0, 80) : "unknown error"}).`, ai_ms: Date.now() - aiStarted }).eq("id", at.runId);
  }
}

/** A run left "running" (for example, the server was stopped) is marked as finished without AI. */
export async function settleStaleRun<T extends { id: string; ai_status: string; created_at: string; ai_error?: string | null }>(run: T | null): Promise<T | null> {
  if (!run || run.ai_status !== "running") return run;
  if (Date.now() - new Date(run.created_at).getTime() < AI_STALE_MS) return run;
  const ai_error = "The AI checks did not finish in time, so only code checks are shown. Run the checks again to retry.";
  await createAdminClient().from("check_runs").update({ ai_status: "unavailable", ai_error }).eq("id", run.id).eq("ai_status", "running");
  return { ...run, ai_status: "unavailable", ai_error };
}
