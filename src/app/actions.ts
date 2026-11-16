"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedDemoWorkspace } from "@/lib/seed/seed-workspace";
import { requireSession } from "@/lib/session";
import { fingerprint, runChecks } from "@/lib/pipeline";
import { headers } from "next/headers";
import { MAX_IMAGE_BYTES, imageTypeOk, storeImage } from "@/lib/images";
import { SAMPLE_DRAFTS } from "@/lib/seed/urja";
import type { Channel } from "@/lib/checks/types";

type Session = Awaited<ReturnType<typeof requireSession>>;

async function logEvent(s: Session, type: string, draftId: string | null, detail: Record<string, unknown> = {}) {
  await s.supabase.from("events").insert({ workspace_id: s.workspace.id, draft_id: draftId, person_id: s.person.id, type, detail });
}

// ── Demo workspace ───────────────────────────────────────────────────────────

export async function startDemo() {
  const supabase = await createClient();
  let { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) throw new Error(`Could not start a demo session: ${error?.message ?? "unknown error"}`);
    auth = { user: data.user };
  }
  const { data: member } = await supabase.from("members").select("workspace_id").eq("user_id", auth.user!.id).limit(1).maybeSingle();
  if (!member) await seedDemoWorkspace(auth.user!.id);
  redirect("/app");
}

/** Throws away the visitor's demo workspace and creates a fresh one. */
export async function resetDemo() {
  const s = await requireSession();
  const admin = createAdminClient();
  const { data: mine } = await admin.from("members").select("workspace_id").eq("user_id", s.user.id);
  await seedDemoWorkspace(s.user.id);
  const old = (mine ?? []).map((m) => m.workspace_id);
  if (old.length) await admin.from("workspaces").delete().in("id", old).eq("is_demo", true);
  redirect("/app");
}

export async function switchPerson(formData: FormData) {
  const s = await requireSession();
  const personId = String(formData.get("person_id"));
  if (!s.people.some((p) => p.id === personId)) return;
  await s.supabase.from("members").update({ active_person_id: personId }).eq("workspace_id", s.workspace.id).eq("user_id", s.user.id);
  const back = String(formData.get("back") ?? "/app");
  redirect(back.startsWith("/app") ? back : "/app");
}

// ── Drafts ─────────────────────────────────────────────────────────────────

const DraftInput = z.object({
  title: z.string().trim().min(1, "Give the draft a title").max(120),
  channel: z.enum(["instagram", "linkedin", "email", "website", "ad"]),
  body: z.string().trim().min(1, "Write or paste the content").max(5000, "Keep it under 5,000 characters"),
  alt_text: z.string().trim().max(400).default(""),
  sample_key: z.string().max(40).optional(),
});

export type FormState = { error?: string } | undefined;

export async function createDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const fields = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = DraftInput.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const d = parsed.data;

  // Optional image: an uploaded file, or the sample ad's image when a sample was loaded.
  let image_path: string | null = null;
  try {
    const file = formData.get("image");
    const sample = SAMPLE_DRAFTS.find((x) => x.key === d.sample_key && x.image);
    if (file instanceof File && file.size > 0) {
      if (!imageTypeOk(file.type)) return { error: "Upload a PNG, JPEG or WebP image." };
      if (file.size > MAX_IMAGE_BYTES) return { error: "The image must be 4 MB or smaller." };
      image_path = await storeImage(s.workspace.id, Buffer.from(await file.arrayBuffer()), file.type);
    } else if (sample?.image && formData.get("use_sample_image") === "1") {
      const h = await headers();
      const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
      const res = await fetch(new URL(sample.image, origin));
      if (!res.ok) return { error: "Could not load the sample image." };
      image_path = await storeImage(s.workspace.id, Buffer.from(await res.arrayBuffer()), "image/png");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not store the image." };
  }

  const { data: draft, error } = await s.supabase
    .from("drafts")
    .insert({ workspace_id: s.workspace.id, title: d.title, channel: d.channel, created_by: s.person.id, sample_key: d.sample_key || null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: version, error: ve } = await s.supabase
    .from("draft_versions")
    .insert({
      workspace_id: s.workspace.id, draft_id: draft.id, version: 1, body: d.body, alt_text: d.alt_text, image_path,
      fingerprint: fingerprint({ body: d.body, alt_text: d.alt_text, image_path, channel: d.channel }), created_by: s.person.id,
    })
    .select("id, draft_id, version, body, alt_text, image_path")
    .single();
  if (ve) return { error: ve.message };

  await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: d.channel, version, codeChecksOnly: s.workspace.code_checks_only });
  await logEvent(s, "draft.created", draft.id, { title: d.title, channel: d.channel, sample: d.sample_key || null, image: !!image_path });
  redirect(`/app/drafts/${draft.id}`);
}

async function loadDraft(s: Session, draftId: string) {
  const { data: draft } = await s.supabase.from("drafts").select("*").eq("id", draftId).single();
  if (!draft) throw new Error("Draft not found");
  const { data: version } = await s.supabase
    .from("draft_versions")
    .select("id, draft_id, version, body, alt_text, image_path, intent, intent_confirmed")
    .eq("draft_id", draftId)
    .eq("version", draft.current_version)
    .single();
  return { draft, version: version! };
}

/** Saves a new version of a draft and re-checks it. An approved draft goes back for re-approval. */
async function newVersion(s: Session, draftId: string, change: { body?: string; alt_text?: string; note: string }) {
  const { draft, version } = await loadDraft(s, draftId);
  const body = change.body ?? version.body;
  const alt_text = change.alt_text ?? version.alt_text;
  const next = draft.current_version + 1;
  const { data: v, error } = await s.supabase
    .from("draft_versions")
    .insert({
      workspace_id: s.workspace.id, draft_id: draftId, version: next, body, alt_text, image_path: version.image_path,
      intent: version.intent, intent_confirmed: version.intent_confirmed,
      fingerprint: fingerprint({ body, alt_text, image_path: version.image_path, channel: draft.channel }), change_note: change.note, created_by: s.person.id,
    })
    .select("id, draft_id, version, body, alt_text, image_path")
    .single();
  if (error) throw new Error(error.message);

  const wasApproved = draft.status === "approved";
  await s.supabase
    .from("drafts")
    .update({ current_version: next, updated_at: new Date().toISOString(), ...(wasApproved ? { status: "draft" } : {}) })
    .eq("id", draftId);
  if (wasApproved) {
    await s.supabase.from("approvals").update({ valid: false }).eq("draft_id", draftId).eq("valid", true);
    await logEvent(s, "approval.invalidated", draftId, { reason: "edited after approval", version: next });
  }
  await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: draft.channel as Channel, version: v, codeChecksOnly: s.workspace.code_checks_only });
  await logEvent(s, "version.created", draftId, { version: next, note: change.note });
}

export async function saveEdit(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const body = String(formData.get("body") ?? "").trim();
  const alt_text = String(formData.get("alt_text") ?? "").trim();
  if (!body || body.length > 5000) return;
  await newVersion(s, draftId, { body, alt_text, note: "Edited by hand" });
  revalidatePath(`/app/drafts/${draftId}`);
}

export async function acceptFix(formData: FormData) {
  const s = await requireSession();
  const findingId = String(formData.get("finding_id"));
  const { data: f } = await s.supabase.from("findings").select("*").eq("id", findingId).single();
  if (!f || f.status !== "open" && f.status !== "upheld") return;
  const { version } = await loadDraft(s, f.draft_id);

  let body = version.body;
  let alt = version.alt_text;
  if (f.fix_kind === "replace" && f.fix_text != null) {
    const at = f.start_at != null && body.slice(f.start_at, f.end_at) === f.quote ? f.start_at : body.indexOf(f.quote);
    if (at < 0) return;
    body = body.slice(0, at) + f.fix_text + body.slice(at + f.quote.length);
  } else if (f.fix_kind === "append" && f.fix_text) {
    body = body + f.fix_text;
  } else if (f.fix_kind === "set_alt" && f.fix_text) {
    alt = f.fix_text;
  } else return;

  await s.supabase.from("findings").update({ status: "accepted" }).eq("id", findingId);
  await s.supabase.from("decisions").insert({ workspace_id: s.workspace.id, draft_id: f.draft_id, finding_id: findingId, rule_code: f.rule_code, action: "accept", person_id: s.person.id });
  await newVersion(s, f.draft_id, { body, alt_text: alt, note: `Accepted the suggested fix for ${f.rule_code}` });
  revalidatePath(`/app/drafts/${f.draft_id}`);
}

export async function disputeFinding(formData: FormData) {
  const s = await requireSession();
  const findingId = String(formData.get("finding_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return;
  const { data: f } = await s.supabase.from("findings").select("id, draft_id, rule_code").eq("id", findingId).single();
  if (!f) return;
  await s.supabase.from("findings").update({ status: "disputed" }).eq("id", findingId);
  await s.supabase.from("decisions").insert({ workspace_id: s.workspace.id, draft_id: f.draft_id, finding_id: f.id, rule_code: f.rule_code, action: "dispute", reason, person_id: s.person.id });
  await s.supabase.from("comments").insert({ workspace_id: s.workspace.id, draft_id: f.draft_id, finding_id: f.id, person_id: s.person.id, body: `Disputed ${f.rule_code}: ${reason}` });
  await logEvent(s, "finding.disputed", f.draft_id, { rule: f.rule_code, reason });
  revalidatePath(`/app/drafts/${f.draft_id}`);
}

// ── Review and approval ─────────────────────────────────────────────────────

/** Findings from the latest check run of the current version. */
async function currentFindings(s: Session, draftId: string) {
  const { version } = await loadDraft(s, draftId);
  const { data: run } = await s.supabase.from("check_runs").select("id").eq("draft_version_id", version.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data } = run ? await s.supabase.from("findings").select("*").eq("check_run_id", run.id) : { data: [] };
  return { version, findings: data ?? [] };
}

/** Runs the checks again on the same version, for example after the AI service was unavailable. */
export async function rerunChecks(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const { draft, version } = await loadDraft(s, draftId);
  await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: draft.channel as Channel, version, codeChecksOnly: s.workspace.code_checks_only });
  await logEvent(s, "checks.rerun", draftId, { version: version.version });
  revalidatePath(`/app/drafts/${draftId}`);
}

/** The creator confirms (or corrects) what the draft is for. Fixes are judged against this purpose. */
export async function confirmIntent(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const clip = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 200);
  const intent = { goal: clip("goal"), audience: clip("audience"), call_to_action: clip("call_to_action") };
  const { version } = await loadDraft(s, draftId);
  await s.supabase.from("draft_versions").update({ intent, intent_confirmed: true }).eq("id", version.id);
  await logEvent(s, "intent.confirmed", draftId, intent);
  revalidatePath(`/app/drafts/${draftId}`);
}

/** Manager setting: run code checks only, so no content is sent to any AI service. */
export async function setCodeChecksOnly(formData: FormData) {
  const s = await requireSession();
  if (s.person.role !== "manager") return;
  const on = formData.get("on") === "true";
  await s.supabase.from("workspaces").update({ code_checks_only: on }).eq("id", s.workspace.id);
  await logEvent(s, "settings.code_checks_only", null, { on });
  revalidatePath("/app", "layout");
}

export async function submitForReview(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const { findings } = await currentFindings(s, draftId);
  const openBlockers = findings.filter((f) => f.severity === "blocker" && (f.status === "open" || f.status === "upheld"));
  if (openBlockers.length) return;

  // Route by risk: claims to legal, visual issues to the design lead, everything else to the brand manager.
  const live = findings.filter((f) => ["open", "disputed", "upheld"].includes(f.status));
  const claims = live.filter((f) => f.category === "claims");
  const visual = live.filter((f) => f.category === "visual");
  const legal = s.people.find((p) => p.reviewer_area === "legal");
  const design = s.people.find((p) => p.reviewer_area === "design");
  const manager = s.people.find((p) => p.role === "manager");
  let reviewer = manager;
  let reason = live.length ? "Only tone, wording or style findings remain, so the brand manager reviews it." : "No open findings, so the brand manager gives the final approval.";
  if (claims.length && legal) {
    reviewer = legal;
    reason = `Claims finding${claims.length > 1 ? "s" : ""} ${[...new Set(claims.map((f) => f.rule_code))].join(", ")} need${claims.length > 1 ? "" : "s"} legal sign-off.`;
  } else if (visual.length && design) {
    reviewer = design;
    reason = `Visual finding${visual.length > 1 ? "s" : ""} ${[...new Set(visual.map((f) => f.rule_code))].join(", ")} go${visual.length > 1 ? "" : "es"} to the design lead.`;
  }
  await s.supabase.from("drafts").update({ status: "in_review", reviewer_id: reviewer?.id ?? null, route_reason: reason, updated_at: new Date().toISOString() }).eq("id", draftId);
  await logEvent(s, "draft.submitted", draftId, { reviewer: reviewer?.name, reason });
  revalidatePath(`/app/drafts/${draftId}`);
}

export async function resolveDispute(formData: FormData) {
  const s = await requireSession();
  if (s.person.role === "creator") return;
  const findingId = String(formData.get("finding_id"));
  const decision = String(formData.get("decision")) === "override" ? "override" : "uphold";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return;
  const { data: f } = await s.supabase.from("findings").select("id, draft_id, rule_code").eq("id", findingId).single();
  if (!f) return;
  await s.supabase.from("findings").update({ status: decision === "override" ? "overridden" : "upheld" }).eq("id", findingId);
  await s.supabase.from("decisions").insert({ workspace_id: s.workspace.id, draft_id: f.draft_id, finding_id: f.id, rule_code: f.rule_code, action: decision, reason, person_id: s.person.id });
  await s.supabase.from("comments").insert({ workspace_id: s.workspace.id, draft_id: f.draft_id, finding_id: f.id, person_id: s.person.id, body: `${decision === "override" ? "Overrode" : "Upheld"} ${f.rule_code}: ${reason}` });
  await logEvent(s, decision === "override" ? "finding.overridden" : "finding.upheld", f.draft_id, { rule: f.rule_code, reason });
  revalidatePath(`/app/drafts/${f.draft_id}`);
}

export async function approveDraft(formData: FormData) {
  const s = await requireSession();
  if (s.person.role === "creator") return;
  const draftId = String(formData.get("draft_id"));
  const { version, findings } = await currentFindings(s, draftId);
  const blocking = findings.filter((f) => f.status === "disputed" || f.status === "upheld" || (f.severity === "blocker" && f.status === "open"));
  if (blocking.length) return;
  const { data: run } = await s.supabase.from("check_runs").select("fingerprint, rulebook_version, ai_model").eq("draft_version_id", version.id).order("created_at", { ascending: false }).limit(1).single();
  const overrides = findings.filter((f) => f.status === "overridden").map((f) => ({ rule: f.rule_code, quote: f.quote }));
  const { error } = await s.supabase.from("approvals").insert({
    workspace_id: s.workspace.id, draft_id: draftId, draft_version_id: version.id, fingerprint: run?.fingerprint ?? "",
    rulebook_version: run?.rulebook_version ?? s.workspace.rulebook_version, approver_id: s.person.id, overrides,
    ai_services: run?.ai_model ? [run.ai_model] : [],
  });
  if (error) throw new Error(error.message);
  await s.supabase.from("drafts").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", draftId);
  await logEvent(s, "draft.approved", draftId, { version: version.version, overrides: overrides.length });
  revalidatePath(`/app/drafts/${draftId}`);
}

export async function requestChanges(formData: FormData) {
  const s = await requireSession();
  if (s.person.role === "creator") return;
  const draftId = String(formData.get("draft_id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  if (note.length < 3) return;
  await s.supabase.from("comments").insert({ workspace_id: s.workspace.id, draft_id: draftId, person_id: s.person.id, body: note });
  await s.supabase.from("drafts").update({ status: "changes_requested", updated_at: new Date().toISOString() }).eq("id", draftId);
  await logEvent(s, "draft.changes_requested", draftId, { note });
  revalidatePath(`/app/drafts/${draftId}`);
}

export async function addComment(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return;
  await s.supabase.from("comments").insert({ workspace_id: s.workspace.id, draft_id: draftId, person_id: s.person.id, body });
  revalidatePath(`/app/drafts/${draftId}`);
}
