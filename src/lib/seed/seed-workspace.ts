import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_GUIDE, PEOPLE } from "./urja";
import { seedFacts, seedPalette, seedRules, seedTerms, seedTypefaces } from "./context";
import { randomUUID } from "node:crypto";
import { LIBRARY, LIBRARY_DECK } from "./library";
import { fingerprint, todayIST } from "@/lib/pipeline";
import { copyLibraryDeck } from "@/lib/documents/store";
import { syncExpiredFacts } from "@/lib/alerts-server";
import { selfOrigin } from "@/lib/origin";

/** Creates a private copy of the Urja Bites demo workspace for one visitor. Returns the workspace id. */
export async function seedDemoWorkspace(userId: string): Promise<string> {
  const db = createAdminClient();
  const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`Seeding ${what} failed: ${r.error.message}`);
    return r.data as T;
  };

  const ws = must(
    await db.from("workspaces").insert({ name: "Urja Bites (demo)", brand_name: "Urja Bites", is_demo: true }).select("id").single(),
    "workspace",
  ) as { id: string };

  const people = must(
    await db.from("people").insert(PEOPLE.map((p, i) => ({ workspace_id: ws.id, name: p.name, title: p.title, role: p.role, reviewer_area: p.reviewer_area ?? null, sort: i }))).select("id, name"),
    "people",
  ) as { id: string; name: string }[];
  const byName = Object.fromEntries(people.map((p) => [p.name, p.id]));

  // These do not depend on each other, so they are written at the same time (a first visit waits for all of them).
  const rules = seedRules();
  const written = await Promise.all([
    db.from("members").insert({ workspace_id: ws.id, user_id: userId, active_person_id: byName["Arjun"] }),
    db.from("rules").insert(rules.map((r) => ({ ...r, workspace_id: ws.id }))),
    db.from("rulebook_versions").insert({
      workspace_id: ws.id, version: 1, note: `Imported from ${BRAND_GUIDE} and approved`, published_by: byName["Meera"], snapshot: rules,
    }),
    db.from("facts").insert(seedFacts().map((f) => ({ ...f, workspace_id: ws.id }))),
    db.from("terms").insert(seedTerms().map((t) => ({ ...t, workspace_id: ws.id }))),
    db.from("assets").insert([
      ...seedPalette().map((c) => ({ workspace_id: ws.id, kind: "color", name: c.name, hex: c.hex })),
      ...seedTypefaces().map((t) => ({ workspace_id: ws.id, kind: "font", name: t.name, note: t.note })),
      { workspace_id: ws.id, kind: "logo", name: "Urja Bites logo", file_path: "/demo/urja-logo.svg", note: "Primary logo. Cream or Cocoa backgrounds only." },
    ]),
    // The first entry of the audit trail, before the sample library's own events below.
    db.from("events").insert({ workspace_id: ws.id, type: "workspace.created", detail: { demo: true } }),
  ]);
  ["membership", "rules", "rulebook version", "facts", "terms", "assets", "event"].forEach((what, i) => must(written[i], what));
  await seedLibrary(ws.id, byName);
  // Facts that have already ended (the Dussehra offer) raise their alerts straight away.
  await syncExpiredFacts(ws.id, todayIST());
  return ws.id;
}

/**
 * The approved sample library (src/lib/seed/library.ts): approved drafts, each with its version, a code-check run and
 * an approval, as if approved on its date before the demo began. Labelled as samples in the app.
 */
async function seedLibrary(workspaceId: string, byName: Record<string, string>) {
  const db = createAdminClient();
  let origin: string | null = null;
  try {
    origin = await selfOrigin();
  } catch {
    origin = null; // outside a request (scripts): the deck is copied only if the shared copy already exists
  }
  const deckPath = await copyLibraryDeck(workspaceId, LIBRARY_DECK, origin);
  const items = LIBRARY.filter((i) => !i.document || deckPath);
  const at = (d: string, hour: number) => new Date(`${d}T${String(hour).padStart(2, "0")}:00:00+05:30`).toISOString();
  const rows = items.map((i) => {
    const draftId = randomUUID();
    const versionId = randomUUID();
    // Every row has the same columns: in a bulk insert a missing column becomes NULL, not its default.
    const file = i.document
      ? { file_path: deckPath, file_name: "urja-diwali-retail-deck-corrected.pdf", file_hash: LIBRARY_DECK.hash, file_size: LIBRARY_DECK.size, page_count: LIBRARY_DECK.pageCount, pages: LIBRARY_DECK.pages, scanned: false }
      : { file_path: null, file_name: null, file_hash: null, file_size: null, page_count: null, pages: null, scanned: false };
    const fp = fingerprint({ body: i.body, alt_text: i.alt_text, image_path: null, channel: i.channel, file_hash: i.document ? LIBRARY_DECK.hash : null });
    return {
      draft: {
        id: draftId, workspace_id: workspaceId, title: i.title, channel: i.channel, status: "approved", created_by: byName[i.owner], current_version: 1,
        reviewer_id: byName[i.approver], route_reason: "Sample content, approved before this demo began.", sample_key: i.key, is_sample: true,
        created_at: at(i.approved_on, 10), updated_at: at(i.approved_on, 16),
      },
      version: { id: versionId, workspace_id: workspaceId, draft_id: draftId, version: 1, body: i.body, alt_text: i.alt_text, image_path: null, fingerprint: fp, created_by: byName[i.owner], created_at: at(i.approved_on, 10), ...file },
      run: {
        workspace_id: workspaceId, draft_version_id: versionId, rulebook_version: 1, fingerprint: fp, ms: 0, ai_status: "skipped", ai_requests: 0,
        ai_error: "Sample content, approved before this demo began; only code checks are shown for it.", created_at: at(i.approved_on, 11),
      },
      approval: {
        workspace_id: workspaceId, draft_id: draftId, draft_version_id: versionId, fingerprint: fp, rulebook_version: 1, approver_id: byName[i.approver],
        file_hash: i.document ? LIBRARY_DECK.hash : null, valid: true, created_at: at(i.approved_on, 16),
      },
      event: { workspace_id: workspaceId, draft_id: draftId, person_id: byName[i.approver], type: "sample.approved", detail: { title: i.title }, created_at: at(i.approved_on, 16) },
    };
  });
  const must = (r: { error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`Seeding the sample library (${what}) failed: ${r.error.message}`);
  };
  must(await db.from("drafts").insert(rows.map((r) => r.draft)), "drafts");
  must(await db.from("draft_versions").insert(rows.map((r) => r.version)), "versions");
  must(await db.from("check_runs").insert(rows.map((r) => r.run)), "check runs");
  must(await db.from("approvals").insert(rows.map((r) => r.approval)), "approvals");
  must(await db.from("events").insert(rows.map((r) => r.event)), "events");
}
