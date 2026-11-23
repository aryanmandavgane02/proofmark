"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedDemoWorkspace } from "@/lib/seed/seed-workspace";
import { selfOrigin } from "@/lib/origin";
import { requireSession } from "@/lib/session";
import { fingerprint, runChecks, settleStaleRun, VERSION_COLUMNS, type RunResult } from "@/lib/pipeline";
import { MAX_IMAGE_BYTES, imageTypeOk, storeImage } from "@/lib/images";
import { SAMPLE_DOCUMENTS, SAMPLE_DRAFTS } from "@/lib/seed/urja";
import { DocumentError, MAX_BYTES, readPdf, type ReadDocument } from "@/lib/documents/read";
import { documentUploadLink, isWorkspaceDocumentPath, loadDocument, removeDocument, removeWorkspaceFiles, storeDocument } from "@/lib/documents/store";
import { closeAlert, notify } from "@/lib/alerts-server";
import { notice } from "@/lib/notice";
import { TEXT_CHANNELS, type Channel, type DocPage } from "@/lib/checks/types";

type Session = Awaited<ReturnType<typeof requireSession>>;

const draftPath = (id: string) => `/app/drafts/${id}`;
const NOT_REVIEWER = "Only a reviewer or the brand manager can do this. Switch person with “Acting as” at the top.";
const ALREADY_DONE = "This was already done, maybe in another tab. The page now shows the latest state.";
const DOCUMENT_NO_EDIT = "A PDF cannot be edited here. Change the source file (for example in Google Slides, Canva or PowerPoint), export it as PDF again and use “Upload a corrected PDF”.";

/**
 * Workflow state (draft status, finding status, versions' intent) is written with the server key,
 * always scoped to the visitor's workspace and only after the row was read through their own access rules.
 */
function server(s: Session) {
  const db = createAdminClient();
  return {
    drafts: (values: Record<string, unknown>, draftId: string) => db.from("drafts").update(values).eq("id", draftId).eq("workspace_id", s.workspace.id),
    finding: (values: Record<string, unknown>, findingId: string) => db.from("findings").update(values).eq("id", findingId).eq("workspace_id", s.workspace.id),
    version: (values: Record<string, unknown>, versionId: string) => db.from("draft_versions").update(values).eq("id", versionId).eq("workspace_id", s.workspace.id),
    /** Append-only records: the workspace and person always come from the session, never the form. */
    record: (table: "events" | "comments" | "decisions" | "approvals", row: Record<string, unknown>) =>
      db.from(table).insert({ ...row, workspace_id: s.workspace.id, ...(table === "approvals" ? { approver_id: s.person.id } : { person_id: s.person.id }) }),
    withdrawApprovals: (draftId: string) => db.from("approvals").update({ valid: false }).eq("draft_id", draftId).eq("workspace_id", s.workspace.id).eq("valid", true),
    /**
     * Status changes only happen from an expected status, in one statement. A double click or a stale tab
     * therefore changes nothing the second time, and the caller tells the visitor instead.
     */
    claimFinding: async (findingId: string, from: string[], to: string) => {
      const { data } = await db.from("findings").update({ status: to }).eq("id", findingId).eq("workspace_id", s.workspace.id).in("status", from).select("id");
      return (data ?? []).length > 0;
    },
    claimDraft: async (draftId: string, from: string[], values: Record<string, unknown>) => {
      const { data } = await db.from("drafts").update(values).eq("id", draftId).eq("workspace_id", s.workspace.id).in("status", from).select("id");
      return (data ?? []).length > 0;
    },
  };
}

async function logEvent(s: Session, type: string, draftId: string | null, detail: Record<string, unknown> = {}) {
  await server(s).record("events", { draft_id: draftId, type, detail });
}

/** Starts the AI half of a check after the response is sent; the page shows the code findings meanwhile. */
function schedule(result: RunResult) {
  if (result.ai) after(result.ai);
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
  const fresh = await seedDemoWorkspace(s.user.id);
  // Remove the visitor's older demo workspaces. Comparing creation times (rather than "all but the new one")
  // means two quick resets cannot delete each other's new workspace.
  const { data: created } = await admin.from("workspaces").select("created_at").eq("id", fresh).single();
  const { data: mine } = await admin.from("members").select("workspace_id").eq("user_id", s.user.id);
  const older = (mine ?? []).map((m) => m.workspace_id).filter((id) => id !== fresh);
  if (older.length && created) {
    const { data: gone } = await admin.from("workspaces").delete().in("id", older).eq("is_demo", true).lt("created_at", created.created_at).select("id");
    await Promise.all((gone ?? []).map((w) => removeWorkspaceFiles(w.id)));
  }
  redirect("/app");
}

export async function switchPerson(formData: FormData) {
  const s = await requireSession();
  const personId = String(formData.get("person_id"));
  const back = String(formData.get("back") ?? "/app");
  const path = back.startsWith("/app") ? back : "/app";
  if (!s.people.some((p) => p.id === personId)) notice(path, "That person is not part of this workspace.");
  await s.supabase.from("members").update({ active_person_id: personId }).eq("workspace_id", s.workspace.id).eq("user_id", s.user.id);
  // The header (in the shared layout) shows who you act as, so refresh the whole layout, not just the page.
  revalidatePath("/app", "layout");
  redirect(path);
}

// ── Drafts ─────────────────────────────────────────────────────────────────

const DraftInput = z.object({
  title: z.string().trim().min(1, "Give the draft a title").max(120),
  channel: z.enum(TEXT_CHANNELS),
  body: z.string().trim().min(1, "Write or paste the content").max(5000, "Keep it under 5,000 characters"),
  alt_text: z.string().trim().max(400).default(""),
  sample_key: z.string().max(40).optional(),
  client_token: z.string().max(64).optional(),
});

export type FormState = { error?: string } | undefined;

/**
 * The key that stops one submission from making two drafts: the form's token plus what was sent. The same form sent twice
 * (double click, retry) gives the same key and opens the draft it already made; the same form sent again with other
 * content (for example after going back in the browser and editing) gives a new key and makes a new draft.
 */
function submissionKey(token: string, parts: (string | number | null | undefined)[]) {
  return createHash("sha256").update([token, ...parts.map((p) => String(p ?? ""))].join("\u0000")).digest("hex");
}

async function draftForToken(s: Session, token: string) {
  const { data } = await s.supabase.from("drafts").select("id").eq("workspace_id", s.workspace.id).eq("client_token", token).maybeSingle();
  return data?.id as string | undefined;
}

export async function createDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const fields = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = DraftInput.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const d = parsed.data;
  const upload = formData.get("image");
  const token = d.client_token
    ? submissionKey(d.client_token, [d.title, d.channel, d.body, d.alt_text, d.sample_key, formData.get("use_sample_image") as string | null,
        upload instanceof File ? `${upload.name}:${upload.size}` : null])
    : null;

  // The same form submitted twice (double click, refresh, retry) opens the draft it already created.
  if (token) {
    const existing = await draftForToken(s, token);
    if (existing) redirect(draftPath(existing));
  }

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
      const res = await fetch(new URL(sample.image, await selfOrigin()));
      if (!res.ok) return { error: "Could not load the sample image." };
      image_path = await storeImage(s.workspace.id, Buffer.from(await res.arrayBuffer()), "image/png");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not store the image." };
  }

  const { data: draft, error } = await s.supabase
    .from("drafts")
    .insert({ workspace_id: s.workspace.id, title: d.title, channel: d.channel, created_by: s.person.id, sample_key: d.sample_key || null, client_token: token })
    .select("id")
    .single();
  if (error) {
    const existing = error.code === "23505" && token ? await draftForToken(s, token) : undefined;
    if (existing) redirect(draftPath(existing));
    return { error: error.message };
  }

  const { data: version, error: ve } = await s.supabase
    .from("draft_versions")
    .insert({
      workspace_id: s.workspace.id, draft_id: draft.id, version: 1, body: d.body, alt_text: d.alt_text, image_path,
      fingerprint: fingerprint({ body: d.body, alt_text: d.alt_text, image_path, channel: d.channel }), created_by: s.person.id,
    })
    .select(VERSION_COLUMNS)
    .single();
  if (ve) {
    await createAdminClient().from("drafts").delete().eq("id", draft.id).eq("workspace_id", s.workspace.id);
    return { error: `Could not save the draft (${ve.message}). Please try again.` };
  }

  schedule(await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: d.channel, version, codeChecksOnly: s.workspace.code_checks_only }));
  await logEvent(s, "draft.created", draft.id, { title: d.title, channel: d.channel, sample: d.sample_key || null, image: !!image_path });
  redirect(draftPath(draft.id));
}

// ── Documents (PDF) ─────────────────────────────────────────────────────────

const DocumentInput = z.object({
  title: z.string().trim().min(1, "Give the document a title").max(120),
  upload_path: z.string().max(200).default(""),
  file_name: z.string().max(300).default(""),
  sample_key: z.string().max(40).default(""),
  client_token: z.string().max(64).optional(),
});

const cleanFileName = (name: string) => name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || "document.pdf";

/**
 * Step 1 of an upload: a one-time link that puts the PDF straight into private storage.
 * (A Vercel function accepts a request body of about 4.5 MB at most, and real decks are often larger.)
 */
export async function prepareDocumentUpload(input: { size: number }): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  const s = await requireSession();
  const size = Number(input?.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "The file is empty." };
  if (size > MAX_BYTES) return { ok: false, error: `The file is ${(size / 1048576).toFixed(1)} MB. Upload a PDF of 15 MB or less.` };
  try {
    return { ok: true, ...(await documentUploadLink(s.workspace.id)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The upload could not be started. Please try again." };
  }
}

/** Step 2: reads the uploaded PDF (or a sample) and refuses anything that cannot be checked, saying exactly why. */
async function receiveDocument(s: Session, d: { upload_path: string; sample_key: string }): Promise<{ path: string; doc: ReadDocument } | { error: string }> {
  const sample = SAMPLE_DOCUMENTS.find((x) => x.key === d.sample_key);
  if (d.upload_path) {
    if (!isWorkspaceDocumentPath(s.workspace.id, d.upload_path)) return { error: "That upload does not belong to this workspace. Choose the file again." };
    const bytes = await loadDocument(d.upload_path);
    if (!bytes) return { error: "The upload did not arrive. Check your connection and choose the file again." };
    try {
      return { path: d.upload_path, doc: await readPdf(bytes) };
    } catch (e) {
      await removeDocument(d.upload_path);
      return { error: e instanceof DocumentError ? e.message : "This PDF could not be read. Export it again and upload the new file." };
    }
  }
  if (!sample) return { error: "Choose a PDF to upload, or load a sample." };
  try {
    const res = await fetch(new URL(sample.file, await selfOrigin()));
    if (!res.ok) return { error: "Could not load the sample document. Please try again." };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const doc = await readPdf(bytes);
    return { path: await storeDocument(s.workspace.id, bytes), doc };
  } catch {
    return { error: "Could not load the sample document. Please try again." };
  }
}

export async function createDocumentDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const parsed = DocumentInput.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const d = parsed.data;
  const sample = SAMPLE_DOCUMENTS.find((x) => x.key === d.sample_key);
  const token = d.client_token ? submissionKey(d.client_token, ["document", d.title, d.upload_path, d.upload_path ? "" : d.sample_key]) : null;
  if (token) {
    const existing = await draftForToken(s, token);
    if (existing) redirect(draftPath(existing));
  }
  const got = await receiveDocument(s, d);
  if ("error" in got) return { error: got.error };
  const name = d.upload_path ? cleanFileName(d.file_name) : sample!.file.split("/").pop()!;
  const file = documentFile(got.path, name, got.doc);

  const { data: draft, error } = await s.supabase
    .from("drafts")
    .insert({ workspace_id: s.workspace.id, title: d.title, channel: "document", created_by: s.person.id, sample_key: d.upload_path ? null : d.sample_key || null, client_token: token })
    .select("id")
    .single();
  if (error) {
    // The same submission arrived twice at once: the first one made the draft (and uses this same file).
    const existing = error.code === "23505" && token ? await draftForToken(s, token) : undefined;
    if (existing) redirect(draftPath(existing));
    await removeDocument(got.path);
    return { error: `Could not save the document (${error.message}). Please try again.` };
  }
  const { data: version, error: ve } = await s.supabase
    .from("draft_versions")
    .insert({
      workspace_id: s.workspace.id, draft_id: draft.id, version: 1, body: got.doc.body, alt_text: "", image_path: null, ...file,
      fingerprint: fingerprint({ body: got.doc.body, alt_text: "", image_path: null, channel: "document", file_hash: file.file_hash }), created_by: s.person.id,
    })
    .select(VERSION_COLUMNS)
    .single();
  if (ve) {
    await createAdminClient().from("drafts").delete().eq("id", draft.id).eq("workspace_id", s.workspace.id);
    await removeDocument(got.path);
    return { error: `Could not save the document (${ve.message}). Please try again.` };
  }
  schedule(await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: "document", version, codeChecksOnly: s.workspace.code_checks_only }));
  await logEvent(s, "draft.created", draft.id, { title: d.title, channel: "document", sample: sample && !d.upload_path ? sample.key : null, file: name, pages: file.page_count });
  redirect(draftPath(draft.id));
}

/** A corrected PDF becomes the next version of a document and is checked again. */
export async function uploadCorrectedDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const { draft, version } = await loadDraft(s, draftId);
  if (draft.channel !== "document") return { error: "Only documents take a corrected PDF." };
  const upload_path = String(formData.get("upload_path") ?? "");
  if (!upload_path) return { error: "Choose the corrected PDF first." };
  const got = await receiveDocument(s, { upload_path, sample_key: "" });
  if ("error" in got) return { error: got.error };
  if (got.doc.hash === version.file_hash) {
    await removeDocument(got.path);
    return { error: `This is the same file as version ${version.version}, so nothing changed. Upload the corrected PDF.` };
  }
  const name = cleanFileName(String(formData.get("file_name") ?? ""));
  await newVersion(s, draftId, { body: got.doc.body, alt_text: "", note: `Uploaded a corrected PDF (${name})`, file: documentFile(got.path, name, got.doc) });
  revalidatePath(draftPath(draftId));
  notice(draftPath(draftId), `Version ${draft.current_version + 1} uploaded. Every page is being checked again.`, "success");
}

async function loadDraft(s: Session, draftId: string) {
  const { data: draft } = await s.supabase.from("drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft) notice("/app", "That draft no longer exists. The demo may have been reset.");
  const { data: version } = await s.supabase
    .from("draft_versions")
    .select(`${VERSION_COLUMNS}, intent, intent_confirmed, file_path, file_name, file_size, page_count`)
    .eq("draft_id", draftId)
    .eq("version", draft.current_version)
    .single();
  return { draft, version: version! };
}

/** The stored file of a document version. */
type DocumentFile = { file_path: string; file_name: string; file_hash: string; file_size: number; page_count: number; pages: DocPage[]; scanned: boolean };

function documentFile(path: string, name: string, doc: ReadDocument): DocumentFile {
  return { file_path: path, file_name: name, file_hash: doc.hash, file_size: doc.size, page_count: doc.pageCount, pages: doc.pages, scanned: doc.scanned };
}

/** Saves a new version of a draft and re-checks it. An approved draft goes back for re-approval. */
async function newVersion(s: Session, draftId: string, change: { body?: string; alt_text?: string; note: string; reuseRunId?: string; file?: DocumentFile }) {
  const { draft, version } = await loadDraft(s, draftId);
  const body = change.body ?? version.body;
  const alt_text = change.alt_text ?? version.alt_text;
  const next = draft.current_version + 1;
  const file: DocumentFile | null = change.file ?? (version.file_path
    ? { file_path: version.file_path, file_name: version.file_name, file_hash: version.file_hash, file_size: version.file_size, page_count: version.page_count, pages: version.pages, scanned: version.scanned }
    : null);
  const { data: v, error } = await s.supabase
    .from("draft_versions")
    .insert({
      workspace_id: s.workspace.id, draft_id: draftId, version: next, body, alt_text, image_path: version.image_path,
      // A new file may say something else: keep the intent only if the creator confirmed it, so the AI suggests a fresh one.
      intent: change.file && !version.intent_confirmed ? null : version.intent, intent_confirmed: version.intent_confirmed, ...(file ?? {}),
      fingerprint: fingerprint({ body, alt_text, image_path: version.image_path, channel: draft.channel, file_hash: file?.file_hash }), change_note: change.note, created_by: s.person.id,
    })
    .select(VERSION_COLUMNS)
    .single();
  if (error) {
    // Two saves at the same moment both try to create the next version; the second one simply stops.
    if (error.code === "23505") notice(draftPath(draftId), ALREADY_DONE, "info");
    throw new Error(error.message);
  }

  // Alerts about the replaced version are settled: the new version is checked against today's facts anyway.
  await createAdminClient().from("fact_alerts").update({ status: "superseded", outcome: `Version ${next} replaced the version this alert was about; it is checked against today's facts.`, resolved_at: new Date().toISOString() })
    .eq("draft_id", draftId).eq("workspace_id", s.workspace.id).eq("status", "open");
  const wasApproved = draft.status === "approved";
  await server(s).drafts({ current_version: next, updated_at: new Date().toISOString(), ...(wasApproved ? { status: "draft" } : {}) }, draftId);
  if (wasApproved) {
    await server(s).withdrawApprovals(draftId);
    await logEvent(s, "approval.invalidated", draftId, { reason: "edited after approval", version: next });
  }
  schedule(await runChecks(s.supabase, {
    workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: draft.channel as Channel, version: v,
    codeChecksOnly: s.workspace.code_checks_only, reuseFrom: change.reuseRunId ? { runId: change.reuseRunId, version: draft.current_version } : undefined,
  }));
  await logEvent(s, "version.created", draftId, { version: next, note: change.note });
}

export async function saveEdit(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const body = String(formData.get("body") ?? "").trim();
  const alt_text = String(formData.get("alt_text") ?? "").trim();
  const { draft, version } = await loadDraft(s, draftId);
  if (draft.channel === "document") notice(draftPath(draftId), DOCUMENT_NO_EDIT, "info");
  if (!body) notice(draftPath(draftId), "The content can't be empty.");
  if (body.length > 5000) notice(draftPath(draftId), "Keep the content under 5,000 characters.");
  if (body === version.body && alt_text === version.alt_text) notice(draftPath(draftId), "Nothing changed, so no new version was saved.", "info");
  await newVersion(s, draftId, { body, alt_text, note: "Edited by hand" });
  revalidatePath(draftPath(draftId));
}

export async function acceptFix(formData: FormData) {
  const s = await requireSession();
  const findingId = String(formData.get("finding_id"));
  const { data: f } = await s.supabase.from("findings").select("*").eq("id", findingId).maybeSingle();
  if (!f) notice("/app", "That finding no longer exists.");
  const path = draftPath(f.draft_id);
  if (f.status !== "open" && f.status !== "upheld") notice(path, ALREADY_DONE, "info");
  const { draft, version } = await loadDraft(s, f.draft_id);
  if (draft.channel === "document") notice(path, DOCUMENT_NO_EDIT, "info");
  if (f.draft_version_id !== version.id) notice(path, "That finding belongs to an older version. The page now shows the current findings.", "info");

  let body = version.body;
  let alt = version.alt_text;
  if (f.fix_kind === "replace" && f.fix_text != null) {
    const at = f.start_at != null && body.slice(f.start_at, f.end_at) === f.quote ? f.start_at : body.indexOf(f.quote);
    if (at < 0) notice(path, "The text this fix applies to has changed. Run the checks again for fresh suggestions.", "info");
    body = body.slice(0, at) + f.fix_text + body.slice(at + f.quote.length);
  } else if (f.fix_kind === "append" && f.fix_text) {
    body = body + f.fix_text;
  } else if (f.fix_kind === "set_alt" && f.fix_text) {
    alt = f.fix_text;
  } else notice(path, "This finding has no automatic fix. Edit the text yourself, or dispute it.", "info");

  if (!(await server(s).claimFinding(findingId, ["open", "upheld"], "accepted"))) notice(path, ALREADY_DONE, "info");
  try {
    await newVersion(s, f.draft_id, { body, alt_text: alt, note: `Accepted the suggested fix for ${f.rule_code}`, reuseRunId: f.check_run_id });
  } catch (e) {
    await server(s).finding({ status: f.status }, findingId); // put the finding back if the new version could not be saved
    throw e;
  }
  await server(s).record("decisions", { draft_id: f.draft_id, finding_id: findingId, rule_code: f.rule_code, action: "accept" });
  revalidatePath(path);
}

export async function disputeFinding(formData: FormData) {
  const s = await requireSession();
  const findingId = String(formData.get("finding_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const { data: f } = await s.supabase.from("findings").select("id, draft_id, rule_code, status").eq("id", findingId).maybeSingle();
  if (!f) notice("/app", "That finding no longer exists.");
  const path = draftPath(f.draft_id);
  if (reason.length < 3) notice(path, "Give a reason (a few words) so the reviewer can decide.");
  if (!(await server(s).claimFinding(findingId, ["open"], "disputed"))) notice(path, ALREADY_DONE, "info");
  await server(s).record("decisions", { draft_id: f.draft_id, finding_id: f.id, rule_code: f.rule_code, action: "dispute", reason });
  await server(s).record("comments", { draft_id: f.draft_id, finding_id: f.id, body: `Disputed ${f.rule_code}: ${reason}` });
  await logEvent(s, "finding.disputed", f.draft_id, { rule: f.rule_code, reason });
  revalidatePath(path);
}

// ── Review and approval ─────────────────────────────────────────────────────

/** Findings from the latest check run of the current version. */
async function currentFindings(s: Session, draftId: string) {
  const { version } = await loadDraft(s, draftId);
  const { data: latest } = await s.supabase
    .from("check_runs")
    .select("id, fingerprint, rulebook_version, ai_model, ai_status, ai_error, created_at")
    .eq("draft_version_id", version.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const run = await settleStaleRun(latest);
  const { data } = run ? await s.supabase.from("findings").select("*").eq("check_run_id", run.id) : { data: [] };
  return { version, run, findings: data ?? [] };
}

/** Runs the checks again on the same version, for example after the AI service was unavailable. */
export async function rerunChecks(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const { draft, version } = await loadDraft(s, draftId);
  const { run } = await currentFindings(s, draftId);
  if (run?.ai_status === "running") notice(draftPath(draftId), "The checks are already running. The results appear here in a few seconds.", "info");
  schedule(await runChecks(s.supabase, { workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: draft.channel as Channel, version, codeChecksOnly: s.workspace.code_checks_only }));
  await logEvent(s, "checks.rerun", draftId, { version: version.version });
  revalidatePath(draftPath(draftId));
}

/** The creator confirms (or corrects) what the draft is for. Fixes are judged against this purpose. */
export async function confirmIntent(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const clip = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 200);
  const intent = { goal: clip("goal"), audience: clip("audience"), call_to_action: clip("call_to_action") };
  if (!intent.goal || !intent.audience || !intent.call_to_action) notice(draftPath(draftId), "Fill in the goal, the audience and the call to action.");
  const { version } = await loadDraft(s, draftId);
  await server(s).version({ intent, intent_confirmed: true }, version.id);
  await logEvent(s, "intent.confirmed", draftId, intent);
  revalidatePath(draftPath(draftId));
}

/** Manager setting: run code checks only, so no content is sent to any AI service. */
export async function setCodeChecksOnly(formData: FormData) {
  const s = await requireSession();
  if (s.person.role !== "manager") notice("/app/ai", "Only the brand manager can change this. Switch to Meera with “Acting as”.");
  const on = formData.get("on") === "true";
  if (on === s.workspace.code_checks_only) notice("/app/ai", on ? "Code checks only is already on." : "AI checks are already on.", "info");
  await s.supabase.from("workspaces").update({ code_checks_only: on }).eq("id", s.workspace.id);
  await logEvent(s, "settings.code_checks_only", null, { on });
  revalidatePath("/app", "layout");
}

export async function submitForReview(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const path = draftPath(draftId);
  const { draft } = await loadDraft(s, draftId);
  if (draft.status === "in_review") notice(path, "This draft is already waiting for review.", "info");
  if (draft.status === "approved") notice(path, "This version is already approved. Editing it starts a new version.", "info");
  const { findings, run } = await currentFindings(s, draftId);
  if (run?.ai_status === "running") notice(path, "The AI checks are still running. Submit again in a few seconds.", "info");
  const openBlockers = findings.filter((f) => f.severity === "blocker" && (f.status === "open" || f.status === "upheld"));
  if (openBlockers.length) notice(path, `Fix or dispute the blocker${openBlockers.length > 1 ? "s" : ""} first: ${[...new Set(openBlockers.map((f) => f.rule_code))].join(", ")}.`);

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
  const ok = await server(s).claimDraft(draftId, ["draft", "changes_requested"], { status: "in_review", reviewer_id: reviewer?.id ?? null, route_reason: reason, updated_at: new Date().toISOString() });
  if (!ok) notice(path, ALREADY_DONE, "info");
  await logEvent(s, "draft.submitted", draftId, { reviewer: reviewer?.name, reason });
  revalidatePath(path);
}

export async function resolveDispute(formData: FormData) {
  const s = await requireSession();
  const findingId = String(formData.get("finding_id"));
  const decision = String(formData.get("decision")) === "override" ? "override" : "uphold";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const { data: f } = await s.supabase.from("findings").select("id, draft_id, rule_code, status").eq("id", findingId).maybeSingle();
  if (!f) notice("/app", "That finding no longer exists.");
  const path = draftPath(f.draft_id);
  if (s.person.role === "creator") notice(path, NOT_REVIEWER);
  if (reason.length < 3) notice(path, "Give a reason (a few words). It is saved with the decision.");
  if (!(await server(s).claimFinding(findingId, ["disputed"], decision === "override" ? "overridden" : "upheld"))) notice(path, ALREADY_DONE, "info");
  await server(s).record("decisions", { draft_id: f.draft_id, finding_id: f.id, rule_code: f.rule_code, action: decision, reason });
  await server(s).record("comments", { draft_id: f.draft_id, finding_id: f.id, body: `${decision === "override" ? "Overrode" : "Upheld"} ${f.rule_code}: ${reason}` });
  await logEvent(s, decision === "override" ? "finding.overridden" : "finding.upheld", f.draft_id, { rule: f.rule_code, reason });
  revalidatePath(path);
}

export async function approveDraft(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const path = draftPath(draftId);
  if (s.person.role === "creator") notice(path, NOT_REVIEWER);
  const { draft } = await loadDraft(s, draftId);
  if (draft.status === "approved") notice(path, "This version is already approved.", "info");
  if (draft.status !== "in_review") notice(path, "This draft is not waiting for review. The creator submits it first.", "info");
  const { version, findings, run } = await currentFindings(s, draftId);
  if (run?.ai_status === "running") notice(path, "The AI checks are still running. Approve again in a few seconds.", "info");
  const blocking = findings.filter((f) => f.status === "disputed" || f.status === "upheld" || (f.severity === "blocker" && f.status === "open"));
  if (blocking.length) notice(path, "Resolve the disputed findings first; upheld or blocking findings must be fixed by the creator.");
  // A document is approved as an exact file: the stored file must still be the one that was checked.
  if (version.file_path) {
    const stored = await loadDocument(version.file_path);
    const hash = stored ? createHash("sha256").update(stored).digest("hex") : null;
    if (hash !== version.file_hash) notice(path, "The stored PDF does not match the file that was checked, so it cannot be approved. Upload the PDF again as a new version.");
  }
  if (!(await server(s).claimDraft(draftId, ["in_review"], { status: "approved", updated_at: new Date().toISOString() }))) notice(path, ALREADY_DONE, "info");
  const overrides = findings.filter((f) => f.status === "overridden").map((f) => ({ rule: f.rule_code, quote: f.quote }));
  const { error } = await server(s).record("approvals", {
    draft_id: draftId, draft_version_id: version.id, fingerprint: run?.fingerprint ?? "", file_hash: version.file_hash ?? null,
    rulebook_version: run?.rulebook_version ?? s.workspace.rulebook_version, overrides,
    ai_services: run?.ai_model ? [run.ai_model] : [],
  });
  if (error) {
    await server(s).drafts({ status: "in_review" }, draftId);
    notice(path, "The approval could not be saved. Please try again.");
  }
  await logEvent(s, "draft.approved", draftId, { version: version.version, overrides: overrides.length });
  revalidatePath(path);
}

export async function requestChanges(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const path = draftPath(draftId);
  if (s.person.role === "creator") notice(path, NOT_REVIEWER);
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  if (note.length < 3) notice(path, "Say what the creator should change (a few words).");
  if (!(await server(s).claimDraft(draftId, ["in_review"], { status: "changes_requested", updated_at: new Date().toISOString() }))) notice(path, ALREADY_DONE, "info");
  await server(s).record("comments", { draft_id: draftId, body: note });
  await logEvent(s, "draft.changes_requested", draftId, { note });
  revalidatePath(path);
}

export async function addComment(formData: FormData) {
  const s = await requireSession();
  const draftId = String(formData.get("draft_id"));
  const findingId = String(formData.get("finding_id") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  const path = draftPath(draftId);
  if (!body) notice(path, "Write a comment first.");
  // Both ids are read through the visitor's own access rules before the server writes the comment.
  const { data: draft } = await s.supabase.from("drafts").select("id").eq("id", draftId).eq("workspace_id", s.workspace.id).maybeSingle();
  if (!draft) notice("/app", "That draft no longer exists. The demo may have been reset.");
  if (findingId && !(await s.supabase.from("findings").select("id").eq("id", findingId).eq("draft_id", draftId).maybeSingle()).data) notice(path, "That finding no longer exists.");
  // The same comment posted twice in quick succession (double click) is saved once.
  const { data: last } = await s.supabase.from("comments").select("body, person_id, created_at").eq("draft_id", draftId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && last.body === body && last.person_id === s.person.id && Date.now() - new Date(last.created_at).getTime() < 30_000) {
    revalidatePath(path);
    return;
  }
  await server(s).record("comments", { draft_id: draftId, finding_id: findingId, body });
  await logEvent(s, "comment.added", draftId, { on_finding: !!findingId });
  revalidatePath(path);
}

// ── Outdated-content alerts (Round 3, improvement 2) ────────────────────────

type AlertRow = {
  id: string; fact_code: string; kind: "changed" | "expiring" | "expired"; draft_id: string; draft_version_id: string; owner_id: string | null;
  before: { statement: string } | null; after: { statement: string; expires_on: string | null } | null; evidence: { quote: string; start: number; end: number; page: number | null; how: string }[]; status: string;
};

const backTo = (v: FormDataEntryValue | null) => {
  const p = String(v ?? "");
  return /^\/app(\/[\w/-]*)?(#[\w-]+)?$/.test(p) ? p : "/app/insights#outdated";
};

/** Sends an approved draft back because a fact it relied on changed: approval withdrawn, owner told. */
async function sendBackForFact(s: Session, alert: AlertRow, title: string, reason: string) {
  const ok = await closeAlert(s.workspace.id, alert.id, "sent_back", reason, s.person.id);
  if (!ok) return false;
  await server(s).claimDraft(alert.draft_id, ["approved"], { status: "changes_requested", updated_at: new Date().toISOString() });
  await server(s).withdrawApprovals(alert.draft_id);
  await logEvent(s, "approval.invalidated", alert.draft_id, { reason: `fact ${alert.fact_code} ${alert.kind === "expired" ? "ended" : "changed"}` });
  await logEvent(s, "alert.sent_back", alert.draft_id, { fact: alert.fact_code, quote: alert.evidence[0]?.quote ?? null });
  await notify(s.workspace.id, alert.owner_id, `“${title}” was sent back for changes. ${reason}`, draftPath(alert.draft_id));
  return true;
}

/**
 * Re-checks the approved version an alert is about, against today's facts (code checks: numbers and dates are checked
 * by code). A finding on the fact sends the draft back; a number still backed by the fact closes the alert as still
 * correct; wording only a person can judge stays open for a reviewer's decision.
 */
async function recheck(s: Session, alert: AlertRow): Promise<{ outcome: "sent_back" | "still_correct" | "superseded" | "person" | "done"; text: string }> {
  if (alert.status !== "open") return { outcome: "done", text: ALREADY_DONE };
  const { data: draft } = await s.supabase.from("drafts").select("id, title, status, channel, current_version").eq("id", alert.draft_id).maybeSingle();
  const { data: version } = draft
    ? await s.supabase.from("draft_versions").select(VERSION_COLUMNS).eq("draft_id", draft.id).eq("version", draft.current_version).single()
    : { data: null };
  if (!draft || !version || version.id !== alert.draft_version_id || draft.status !== "approved") {
    const why = !draft ? "The draft no longer exists." : `“${draft.title}” changed after this alert (it is now ${draft.status === "approved" ? `version ${draft.current_version}` : draft.status.replace("_", " ")}), and new versions are checked as usual.`;
    await closeAlert(s.workspace.id, alert.id, "superseded", why, s.person.id);
    return { outcome: "superseded", text: why };
  }
  if (alert.kind === "expiring") {
    const until = alert.after?.expires_on ? new Date(`${alert.after.expires_on}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "its end date";
    return { outcome: "person", text: `The fact is still valid until ${until}, so “${draft.title}” is correct today. The alert turns into an “ended” alert on that date; to update it now, send it back.` };
  }
  const result = await runChecks(s.supabase, {
    workspaceId: s.workspace.id, rulebookVersion: s.workspace.rulebook_version, channel: draft.channel as Channel, version,
    skipAI: `re-checked after fact ${alert.fact_code} ${alert.kind === "expired" ? "ended" : "changed"}; numbers and dates are checked by code.`,
  });
  const { data: found } = await s.supabase.from("findings").select("rule_code, fact_code, quote, start_at, end_at, page, message").eq("check_run_id", result.runId);
  // Only a finding about facts counts (it cites this fact, or a fact where the old value was quoted): a finding from
  // some other rule is not a reason to say the fact made the draft out of date.
  const relevant = (found ?? []).filter((f) => f.fact_code === alert.fact_code || (!!f.fact_code && f.start_at != null && alert.evidence.some((e) => f.start_at < e.end && e.start < f.end_at)));
  await logEvent(s, "checks.rerun", draft.id, { version: version.version, reason: `fact ${alert.fact_code}` });
  if (relevant.length) {
    const f = relevant[0];
    const where = `${f.page ? `page ${f.page}, ` : ""}“${f.quote.length > 60 ? `${f.quote.slice(0, 60)}…` : f.quote}”`;
    const what = alert.kind === "expired" ? `relies on fact ${alert.fact_code}, which has ended` : `no longer matches fact ${alert.fact_code}`;
    const reason = `${where} ${what}. ${f.message}`.slice(0, 450);
    const ok = await sendBackForFact(s, alert, draft.title, reason);
    const owner = s.people.find((p) => p.id === alert.owner_id)?.name ?? "its owner";
    return ok ? { outcome: "sent_back", text: `Sent “${draft.title}” back for changes: ${where} ${what}. The approval was withdrawn and ${owner} was told. Once it is fixed, it goes through review again.` } : { outcome: "done", text: ALREADY_DONE };
  }
  if (alert.evidence.some((e) => e.how === "quotes")) {
    const text = `Still correct: “${alert.evidence.find((e) => e.how === "quotes")!.quote}” in “${draft.title}” is still backed by the facts, so the approval stands and nothing needs to be submitted again.`;
    const ok = await closeAlert(s.workspace.id, alert.id, "still_correct", text, s.person.id);
    if (ok) await logEvent(s, "alert.still_correct", draft.id, { fact: alert.fact_code });
    return ok ? { outcome: "still_correct", text } : { outcome: "done", text: ALREADY_DONE };
  }
  const text = `Checked again: no rule fails in “${draft.title}”, but code cannot judge whether its wording still fits fact ${alert.fact_code}. A reviewer or the brand manager decides below.`;
  await createAdminClient().from("fact_alerts").update({ outcome: text }).eq("id", alert.id).eq("workspace_id", s.workspace.id).eq("status", "open");
  return { outcome: "person", text };
}

export async function recheckAlert(formData: FormData) {
  const s = await requireSession();
  const back = backTo(formData.get("back"));
  const { data: alert } = await s.supabase.from("fact_alerts").select("*").eq("id", String(formData.get("alert_id"))).maybeSingle();
  if (!alert) notice(back, "That alert no longer exists. The demo may have been reset.");
  const r = await recheck(s, alert as AlertRow);
  revalidatePath("/app", "layout");
  notice(back, r.text, r.outcome === "sent_back" || r.outcome === "still_correct" ? "success" : "info");
}

/** Re-checks every open alert of one fact. */
export async function recheckFactAlerts(formData: FormData) {
  const s = await requireSession();
  const back = backTo(formData.get("back"));
  const code = String(formData.get("fact_code"));
  const { data: alerts } = await s.supabase.from("fact_alerts").select("*").eq("workspace_id", s.workspace.id).eq("fact_code", code).eq("status", "open").in("kind", ["changed", "expired"]);
  if (!alerts?.length) notice(back, `No open alerts for ${code}. They may have been re-checked in another tab.`, "info");
  const tally = { sent_back: 0, still_correct: 0, person: 0, other: 0 };
  for (const a of alerts) {
    const r = await recheck(s, a as AlertRow);
    if (r.outcome === "sent_back" || r.outcome === "still_correct" || r.outcome === "person") tally[r.outcome]++;
    else tally.other++;
  }
  revalidatePath("/app", "layout");
  const parts = [
    tally.sent_back && `${tally.sent_back} sent back for changes`,
    tally.still_correct && `${tally.still_correct} still correct`,
    tally.person && `${tally.person} left for a reviewer to decide`,
    tally.other && `${tally.other} already changed or done`,
  ].filter(Boolean);
  // User tests: people were unsure whether a re-checked draft has to be submitted again. Say what happens next.
  const next = [
    tally.sent_back && "A draft sent back goes to its writer to fix, then through review again.",
    tally.still_correct && "A draft still correct keeps its approval; nothing needs to be submitted again.",
  ].filter(Boolean).join(" ");
  notice(back, `Re-checked ${alerts.length} approved draft${alerts.length === 1 ? "" : "s"} for ${code}: ${parts.join(", ")}.${next ? ` ${next}` : ""}`, "success");
}

/** A reviewer's decision on an alert code cannot settle (wording, or an offer that has not ended yet). */
export async function decideAlert(formData: FormData) {
  const s = await requireSession();
  const back = backTo(formData.get("back"));
  if (s.person.role === "creator") notice(back, NOT_REVIEWER);
  const { data: alert } = await s.supabase.from("fact_alerts").select("*").eq("id", String(formData.get("alert_id"))).maybeSingle();
  if (!alert) notice(back, "That alert no longer exists. The demo may have been reset.");
  if (alert.status !== "open") notice(back, ALREADY_DONE, "info");
  const { data: draft } = await s.supabase.from("drafts").select("title, status").eq("id", alert.draft_id).maybeSingle();
  if (!draft) notice(back, "That draft no longer exists.");
  if (formData.get("decision") === "send_back") {
    const reason = `${s.person.name} decided it must be updated: it relies on fact ${alert.fact_code} (“${(alert as AlertRow).after?.statement ?? alert.fact_code}”).`;
    const ok = draft.status === "approved" && (await sendBackForFact(s, alert as AlertRow, draft.title, reason));
    if (!ok) notice(back, draft.status === "approved" ? ALREADY_DONE : `“${draft.title}” is no longer approved, so there is nothing to send back.`, "info");
    revalidatePath("/app", "layout");
    notice(back, `Sent “${draft.title}” back for changes. Its approval was withdrawn and its owner was told.`, "success");
  }
  const ok = await closeAlert(s.workspace.id, alert.id, "still_correct", `${s.person.name} reviewed it: still correct after fact ${alert.fact_code} changed.`, s.person.id);
  if (!ok) notice(back, ALREADY_DONE, "info");
  await logEvent(s, "alert.still_correct", alert.draft_id, { fact: alert.fact_code, by: s.person.name });
  revalidatePath("/app", "layout");
  notice(back, `Marked “${draft.title}” as still correct.`, "success");
}

export async function markNotificationsRead() {
  const s = await requireSession();
  await createAdminClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("workspace_id", s.workspace.id).eq("person_id", s.person.id).is("read_at", null);
  revalidatePath("/app", "layout");
  notice("/app/notifications", "All your notifications are marked as read.", "success");
}
