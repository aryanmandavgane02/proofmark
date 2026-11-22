import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_GUIDE, PEOPLE } from "./urja";
import { seedFacts, seedPalette, seedRules, seedTerms, seedTypefaces } from "./context";

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

  must(await db.from("members").insert({ workspace_id: ws.id, user_id: userId, active_person_id: byName["Arjun"] }), "membership");

  const rules = seedRules();
  must(await db.from("rules").insert(rules.map((r) => ({ ...r, workspace_id: ws.id }))), "rules");
  must(
    await db.from("rulebook_versions").insert({
      workspace_id: ws.id, version: 1, note: `Imported from ${BRAND_GUIDE} and approved`, published_by: byName["Meera"], snapshot: rules,
    }),
    "rulebook version",
  );
  must(await db.from("facts").insert(seedFacts().map((f) => ({ ...f, workspace_id: ws.id }))), "facts");
  must(await db.from("terms").insert(seedTerms().map((t) => ({ ...t, workspace_id: ws.id }))), "terms");
  must(
    await db.from("assets").insert([
      ...seedPalette().map((c) => ({ workspace_id: ws.id, kind: "color", name: c.name, hex: c.hex })),
      ...seedTypefaces().map((t) => ({ workspace_id: ws.id, kind: "font", name: t.name, note: t.note })),
      { workspace_id: ws.id, kind: "logo", name: "Urja Bites logo", file_path: "/demo/urja-logo.svg", note: "Primary logo. Cream or Cocoa backgrounds only." },
    ]),
    "assets",
  );
  must(await db.from("events").insert({ workspace_id: ws.id, type: "workspace.created", detail: { demo: true } }), "event");
  return ws.id;
}
