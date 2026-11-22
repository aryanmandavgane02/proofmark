"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { selfOrigin } from "@/lib/origin";
import { pendingChanges, publishApprovedRules } from "@/lib/rulebook";
import { notice } from "@/lib/notice";
import { requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/gemini";
import { AIUnavailableError } from "@/lib/ai/provider";
import { MAX_PDF_BYTES, draftRulesFromPages, pdfPages } from "@/lib/ai/import";
import { verifyImportedRules } from "@/lib/checks/import-verify";
import { CHANNELS } from "@/lib/checks/types";

export type BrandFormState = { error?: string; ok?: string } | undefined;
type Session = Awaited<ReturnType<typeof requireSession>>;

async function managerSession() {
  const s = await requireSession();
  if (s.person.role !== "manager") return null;
  return s;
}

async function logEvent(s: Session, type: string, detail: Record<string, unknown>) {
  await createAdminClient().from("events").insert({ workspace_id: s.workspace.id, person_id: s.person.id, type, detail });
}

const SAMPLE_GUIDES: Record<string, string> = {
  update: "/samples/urja-guideline-update-nov-2026.pdf",
  full: "/samples/urja-brand-guide.pdf",
};

// ── Import rules from a brand-guide PDF ────────────────────────────────────

export async function importGuide(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const s = await managerSession();
  if (!s) return { error: "Only the brand manager can import rules. Switch to Meera with “Acting as”." };
  let bytes: Buffer;
  let fileName: string;
  const file = formData.get("file");
  const sample = String(formData.get("sample") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return { error: "Upload a PDF file." };
    if (file.size > MAX_PDF_BYTES) return { error: "The PDF must be 4 MB or smaller." };
    bytes = Buffer.from(await file.arrayBuffer());
    fileName = file.name.slice(0, 120);
  } else if (SAMPLE_GUIDES[sample]) {
    const res = await fetch(new URL(SAMPLE_GUIDES[sample], await selfOrigin()));
    if (!res.ok) return { error: "Could not load the sample document." };
    bytes = Buffer.from(await res.arrayBuffer());
    fileName = SAMPLE_GUIDES[sample].split("/").pop()!;
  } else return { error: "Choose a PDF, or one of the sample documents." };

  let pages: string[];
  try {
    pages = await pdfPages(bytes);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the PDF." };
  }
  const provider = getProvider();
  if (!provider || s.workspace.code_checks_only) {
    return { error: "Drafting rules from a document needs AI, which is off or unavailable here. You can still add rules by hand." };
  }
  let drafted;
  try {
    drafted = await draftRulesFromPages(provider, pages, s.workspace.id);
  } catch (e) {
    return { error: e instanceof AIUnavailableError ? e.message : "The AI could not read this document. Try again in a minute." };
  }

  const { data: existing } = await s.supabase.from("rules").select("code, source_quote").eq("workspace_id", s.workspace.id);
  const { rules, dropped } = verifyImportedRules(drafted.rules, pages, existing ?? []);

  const admin = createAdminClient();
  const { data: imp, error } = await admin
    .from("imports")
    .insert({ workspace_id: s.workspace.id, file_name: fileName, pages: pages.length, drafted: rules.length, dropped, ai_model: drafted.model, person_id: s.person.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (rules.length) {
    const { error: re } = await s.supabase.from("rules").insert(
      rules.map((r) => ({
        workspace_id: s.workspace.id, code: r.code, category: r.category, title: r.title, statement: r.statement, severity: r.severity,
        channels: [], check_kind: "ai", check_type: null, params: {}, source_doc: fileName, source_page: r.source_page, source_quote: r.source_quote,
        status: "draft", import_id: imp.id,
      })),
    );
    if (re) return { error: re.message };
  }
  await logEvent(s, "rules.imported", { file: fileName, drafted: rules.length, dropped: dropped.length });
  redirect(`/app/rulebook?import=${imp.id}`);
}

// ── Review, edit and publish rules ─────────────────────────────────────────

const RuleEdit = z.object({
  code: z.string().min(1).max(20),
  title: z.string().trim().min(1).max(80),
  statement: z.string().trim().min(5).max(400),
  severity: z.enum(["blocker", "major", "minor"]),
});

const MANAGER_ONLY = "Only the brand manager can change the rulebook. Switch to Meera with “Acting as”.";

export async function reviewRule(formData: FormData) {
  const s = await managerSession();
  if (!s) notice("/app/rulebook", MANAGER_ONLY);
  const decision = String(formData.get("decision"));
  const parsed = RuleEdit.safeParse(Object.fromEntries(formData));
  if (!parsed.success) notice("/app/rulebook", "Each rule needs a title and a rule of at least a few words.");
  const r = parsed.data;
  const channels = formData.getAll("channels").map(String).filter((c) => (CHANNELS as string[]).includes(c));
  if (!channels.length) notice("/app/rulebook", `Tick at least one channel for ${r.code}.`); // none ticked would otherwise read as "all channels"
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : undefined;
  await s.supabase
    .from("rules")
    .update({ title: r.title, statement: r.statement, severity: r.severity, channels: channels.length === CHANNELS.length ? [] : channels, ...(status ? { status } : {}), updated_at: new Date().toISOString() })
    .eq("workspace_id", s.workspace.id)
    .eq("code", r.code);
  await logEvent(s, status ? `rule.${status}` : "rule.edited", { code: r.code });
  revalidatePath("/app/rulebook");
}

export async function approveAllVerified(formData: FormData) {
  const s = await managerSession();
  if (!s) notice("/app/rulebook", MANAGER_ONLY);
  const importId = String(formData.get("import_id"));
  const { data } = await s.supabase.from("rules").update({ status: "approved", updated_at: new Date().toISOString() }).eq("workspace_id", s.workspace.id).eq("import_id", importId).eq("status", "draft").select("code");
  if (!data?.length) notice("/app/rulebook", "Nothing left to approve: every rule from this import has already been reviewed.", "info");
  await logEvent(s, "rule.approved", { code: data.map((r) => r.code).join(", ") });
  revalidatePath("/app/rulebook");
  notice("/app/rulebook", `Approved ${data.length} rule${data.length === 1 ? "" : "s"}. Publish them to make them live.`, "success");
}

export async function publishRulebook(formData: FormData) {
  const s = await managerSession();
  if (!s) notice("/app/rulebook", MANAGER_ONLY);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || "Rule changes";
  const [{ data: approved }, { data: latest }] = await Promise.all([
    s.supabase.from("rules").select("code, title, statement, severity, channels, params").eq("workspace_id", s.workspace.id).eq("status", "approved"),
    s.supabase.from("rulebook_versions").select("version, snapshot").eq("workspace_id", s.workspace.id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const pending = pendingChanges(approved ?? [], (latest?.snapshot ?? []) as never[]);
  if (latest && !pending.added.length && !pending.changed.length && !pending.removed.length) notice("/app/rulebook", `Nothing to publish: v${latest.version} already has these rules.`, "info");
  const { version, already } = await publishApprovedRules(s, note);
  revalidatePath("/app", "layout");
  notice("/app/rulebook", already ? `Already published as v${version}.` : `Published rulebook v${version}. New checks use it from now on.`, already ? "info" : "success");
}

// ── Facts, terms and colours ───────────────────────────────────────────────

const FactInput = z.object({
  code: z.string().trim().regex(/^F-\d{1,3}$/, "Fact codes look like F-20"),
  statement: z.string().trim().min(5).max(300),
  value: z.string().trim().max(20).optional(),
  unit: z.enum(["", "count", "%", "inr", "g", "rating"]).optional(),
  keywords: z.string().trim().max(300).optional(),
  source: z.string().trim().min(2, "Every fact needs a source").max(120),
  owner: z.string().trim().min(2, "Every fact needs an owner").max(60),
  expires_on: z.string().trim().max(10).optional(),
  restricted: z.string().optional(),
});

export async function saveFact(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const s = await managerSession();
  if (!s) return { error: "Only the brand manager can change facts." };
  const parsed = FactInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const f = parsed.data;
  const value = f.value ? Number(f.value.replace(/,/g, "")) : null;
  if (f.value && Number.isNaN(value)) return { error: "The value must be a number, like 35000 or 4.6" };
  const row = {
    workspace_id: s.workspace.id, code: f.code, statement: f.statement, kind: value != null && f.unit ? "number" : "text", value, unit: f.unit || null,
    keywords: (f.keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean), source: f.source, owner: f.owner,
    expires_on: f.expires_on || null, restricted: f.restricted === "on", status: "approved",
  };
  const isEdit = formData.get("mode") === "edit";
  const { error } = isEdit
    ? await s.supabase.from("facts").update(row).eq("workspace_id", s.workspace.id).eq("code", f.code)
    : await s.supabase.from("facts").insert(row);
  if (error) return { error: error.message.includes("duplicate") ? `${f.code} already exists` : error.message };
  await logEvent(s, isEdit ? "fact.edited" : "fact.added", { code: f.code });
  revalidatePath("/app/facts");
  return { ok: isEdit ? `${f.code} updated.` : `${f.code} added. New drafts are checked against it straight away.` };
}

export async function addTerm(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const s = await managerSession();
  if (!s) return { error: "Only the brand manager can change the glossary." };
  const preferred = String(formData.get("preferred") ?? "").trim().slice(0, 60);
  const avoid = String(formData.get("avoid") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || "Approved term.";
  if (!preferred || !avoid.length) return { error: "Give the approved term and at least one word to avoid." };
  const { data: existing } = await s.supabase.from("terms").select("preferred").eq("workspace_id", s.workspace.id);
  if ((existing ?? []).some((t) => t.preferred.toLowerCase() === preferred.toLowerCase())) return { error: `“${preferred}” is already in the glossary.` };
  const { error } = await s.supabase.from("terms").insert({ workspace_id: s.workspace.id, preferred, avoid, case_sensitive: formData.get("case_sensitive") === "on", reason });
  if (error) return { error: error.message };
  await logEvent(s, "term.added", { preferred });
  revalidatePath("/app/facts");
  return { ok: `Added “${preferred}”.` };
}

export async function addColor(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const s = await managerSession();
  if (!s) return { error: "Only the brand manager can change the palette." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const hex = String(formData.get("hex") ?? "").trim().toUpperCase();
  if (!name || !/^#[0-9A-F]{6}$/.test(hex)) return { error: "Give a name and a colour like #F4A300." };
  const { data: existing } = await s.supabase.from("assets").select("name, hex").eq("workspace_id", s.workspace.id).eq("kind", "color");
  const same = (existing ?? []).find((a) => (a.hex ?? "").toUpperCase() === hex);
  if (same) return { error: `${hex} is already in the palette as ${same.name}.` };
  const { error } = await s.supabase.from("assets").insert({ workspace_id: s.workspace.id, kind: "color", name, hex });
  if (error) return { error: error.message };
  await logEvent(s, "color.added", { name, hex });
  revalidatePath("/app/facts");
  return { ok: `Added ${name} ${hex}.` };
}
