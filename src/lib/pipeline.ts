import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCodeChecks, sortFindings } from "@/lib/checks";
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
export async function runChecks(db: SupabaseClient, input: { workspaceId: string; rulebookVersion: number; channel: Channel; version: VersionRow; codeChecksOnly?: boolean; reuseFrom?: { runId: string; version: number } }) {
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

  const codeFindings: FindingDraft[] = runCodeChecks(ctx);
  const fp = fingerprint({ ...input.version, channel: input.channel });

  // Image: colours are checked by code; everything else about the picture goes to the AI below.
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

  // AI step: never blocks the code findings. Every AI finding must pass the proof check.
  let aiFindings: FindingDraft[] = [];
  let dropped: Dropped[] = [];
  let ai_status: "ok" | "cached" | "reused" | "unavailable" | "skipped" | "off" = "skipped";
  let ai_requests = 0;
  let ai_model: string | null = null;
  let ai_error: string | null = null;
  let intent: unknown = null;
  let reused_count = 0;
  let reused_from_version: number | null = null;
  const aiStarted = Date.now();
  const provider = getProvider();

  // Only the changed parts are re-checked: after an accepted fix, AI findings whose text did not change
  // are carried over from the previous run instead of asking the AI again. Code re-checks everything.
  let reused = false;
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
        aiFindings.push({
          category: f.category, severity: f.severity, rule_code: f.rule_code, fact_code: f.fact_code, field: f.field,
          quote: f.quote, start, end, message: f.message, fix_kind: f.fix_kind, fix_text: f.fix_text, label: f.label,
        });
        reused_count++;
      }
      reused = true;
      ai_status = "reused";
      ai_model = prevRun.ai_model;
      reused_from_version = input.reuseFrom.version;
    }
  }

  if (reused) {
    // nothing else to do: the AI was not needed for this version
  } else if (input.codeChecksOnly) ai_status = "off";
  else if (!provider) {
    ai_status = "unavailable";
    ai_error = "No AI key is configured, so only code checks ran.";
  } else {
    try {
      const text = await reviewText(provider, ctx, input.workspaceId);
      ai_requests += text.requests;
      ai_model = text.model;
      intent = text.review.intent;
      const proof = proofCheck(text.review.findings, ctx, codeFindings);
      dropped = proof.dropped;
      aiFindings = proof.kept;
      const judgment = aiFindings.filter((f) => f.category === "tone" || f.category === "messaging");
      if (judgment.length) {
        try {
          const second = await secondOpinion(provider, ctx, judgment, input.workspaceId);
          ai_requests += second.requests;
          judgment.forEach((f, i) => {
            const v = second.verdicts.find((x) => x.index === i);
            if (!v || !v.violates) f.label = "needs_judgment";
          });
        } catch {
          judgment.forEach((f) => (f.label = "needs_judgment"));
        }
      }
      if (image) {
        try {
          const img = await reviewImage(provider, ctx, { ...image.forAI, hash: image.hash }, { mimeType: "image/png", data: URJA_LOGO_PNG_BASE64 }, input.workspaceId);
          ai_requests += img.requests;
          const inText = imageTextFindings(img.review.text_in_image, ctx);
          const visual = imageAIFindings(img.review, ctx);
          aiFindings.push(...inText.map((f) => ({ ...f, label: "needs_judgment" as const, message: `${f.message} (The rule was checked by code; the text was read from the image by AI, so please confirm it.)` })), ...visual.kept);
          dropped.push(...visual.dropped);
          attachAltSuggestion(codeFindings, img.review.alt_text);
        } catch (e) {
          imageError = e instanceof AIUnavailableError ? e.message : "The AI could not review the image.";
        }
      }
      ai_status = text.cached && ai_requests === 0 ? "cached" : "ok";
    } catch (e) {
      ai_status = "unavailable";
      ai_error = e instanceof AIUnavailableError ? e.message : "The AI check failed, so only code checks ran.";
    }
  }
  if (imageError) ai_error = ai_error ? `${ai_error} ${imageError}` : imageError;
  const findings = sortFindings([...codeFindings, ...aiFindings]);
  if (intent) await db.from("draft_versions").update({ intent }).eq("id", input.version.id).is("intent", null);

  const { data: run, error } = await db
    .from("check_runs")
    .insert({
      workspace_id: input.workspaceId,
      draft_version_id: input.version.id,
      rulebook_version: input.rulebookVersion,
      fingerprint: fp,
      ms: Date.now() - started,
      ai_ms: ai_status === "off" ? null : Date.now() - aiStarted,
      reused_count,
      reused_from_version,
      ai_status,
      ai_requests,
      ai_model,
      ai_error,
      dropped,
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
