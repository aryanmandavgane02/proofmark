import { requireSession } from "@/lib/session";
import { signedDocumentUrl } from "@/lib/documents/store";

/**
 * Opens the exact PDF of one version of a document (?v=2; the current version without it). Access is checked through
 * the visitor's own row-level security, then the browser is sent to a storage link that works for five minutes.
 * A "#page=4" on this address is kept by the browser through the redirect, so the PDF opens on that page.
 */
export async function GET(req: Request, ctx: RouteContext<"/app/drafts/[id]/file">) {
  const { id } = await ctx.params;
  const s = await requireSession();
  const { data: draft } = await s.supabase.from("drafts").select("current_version, channel").eq("id", id).maybeSingle();
  if (!draft || draft.channel !== "document") return new Response("This document does not exist (the demo may have been reset).", { status: 404 });
  const asked = Number(new URL(req.url).searchParams.get("v"));
  const version = Number.isInteger(asked) && asked >= 1 ? asked : draft.current_version;
  const { data: row } = await s.supabase.from("draft_versions").select("file_path").eq("draft_id", id).eq("version", version).maybeSingle();
  const url = row?.file_path ? await signedDocumentUrl(row.file_path, s.workspace.id, 300) : null;
  if (!url) return new Response("This version has no stored file.", { status: 404 });
  return new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });
}
