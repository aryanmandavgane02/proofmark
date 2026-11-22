import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_BYTES } from "./read";

// PDFs live in the private "documents" bucket, one file per version, never overwritten. Only the server reads them,
// after the visitor's access to the draft has been checked through row-level security.
const BUCKET = "documents";
/** Uploads a workspace may start per day (each is one signed link). Keeps a public demo from being used as file storage. */
const DAILY_UPLOADS = 40;

export function newDocumentPath(workspaceId: string) {
  return `${workspaceId}/${randomUUID()}.pdf`;
}

/** A path the server itself handed out for this workspace (never trust a path from the form otherwise). */
export function isWorkspaceDocumentPath(workspaceId: string, path: string) {
  return new RegExp(`^${workspaceId}/[0-9a-f-]{36}\\.pdf$`).test(path);
}

/** A one-time link the browser uses to put the PDF straight into storage (Vercel accepts request bodies of 4.5 MB at most). */
export async function documentUploadLink(workspaceId: string): Promise<{ path: string; url: string }> {
  const db = createAdminClient();
  const { data: ok } = await db.rpc("take_ai_request", { p_scope: `uploads:${workspaceId}`, p_limit: DAILY_UPLOADS });
  if (!ok) throw new Error(`This workspace has uploaded ${DAILY_UPLOADS} documents today, the demo limit. Try again tomorrow.`);
  const path = newDocumentPath(workspaceId);
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("The upload could not be started. Please try again.");
  return { path, url: data.signedUrl };
}

export async function storeDocument(workspaceId: string, bytes: Uint8Array): Promise<string> {
  if (bytes.length > MAX_BYTES) throw new Error("Upload a PDF of 15 MB or less.");
  const path = newDocumentPath(workspaceId);
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Could not store the document: ${error.message}`);
  return path;
}

/** The uploaded file, or null when nothing arrived at that path. */
export async function loadDocument(path: string): Promise<Uint8Array | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeDocument(path: string) {
  await createAdminClient().storage.from(BUCKET).remove([path]);
}

/** A short-lived link to the exact stored file; only for a file inside the visitor's own workspace. */
export async function signedDocumentUrl(path: string, workspaceId: string, seconds = 300): Promise<string | null> {
  if (!isWorkspaceDocumentPath(workspaceId, path)) return null;
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Removes every stored file of a workspace (draft images and documents), for example when a demo is reset. Best effort. */
export async function removeWorkspaceFiles(workspaceId: string) {
  const db = createAdminClient();
  for (const bucket of ["drafts", BUCKET]) {
    try {
      for (let round = 0; round < 20; round++) {
        const { data } = await db.storage.from(bucket).list(workspaceId, { limit: 1000 });
        if (!data?.length) break;
        await db.storage.from(bucket).remove(data.map((f) => `${workspaceId}/${f.name}`));
      }
    } catch {
      // Files left behind are private and unreachable once the workspace is gone; never fail a reset over them.
    }
  }
}

/**
 * The approved sample deck of a new demo workspace, copied inside storage from one shared copy (made on first use from
 * the app's own sample file, and only if its SHA-256 matches, so approval checks keep passing). Null if unavailable.
 */
export async function copyLibraryDeck(workspaceId: string, deck: { file: string; hash: string }, origin: string | null): Promise<string | null> {
  const db = createAdminClient();
  const shared = `library/${deck.hash}.pdf`;
  const dest = newDocumentPath(workspaceId);
  let { error } = await db.storage.from(BUCKET).copy(shared, dest);
  if (error && origin) {
    try {
      const res = await fetch(new URL(deck.file, origin));
      const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
      if (bytes && createHash("sha256").update(bytes).digest("hex") === deck.hash) {
        await db.storage.from(BUCKET).upload(shared, bytes, { contentType: "application/pdf", upsert: true });
        ({ error } = await db.storage.from(BUCKET).copy(shared, dest));
      }
    } catch {
      // no deck in this workspace's library; everything else still works
    }
  }
  return error ? null : dest;
}
