// Proves the database enforces access rules: run with `npm run rls-check`.
// Signs in two anonymous visitors, gives each a demo workspace, then tries actions that must be refused.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { seedDemoWorkspace } from "../src/lib/seed/seed-workspace";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };

async function visitor() {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  const ws = await seedDemoWorkspace(data.user!.id);
  return { c, ws, uid: data.user!.id };
}

async function main() {
  const a = await visitor();
  const b = await visitor();
  const people = (await a.c.from("people").select("id, name, role").eq("workspace_id", a.ws)).data!;
  const id = (n: string) => people.find((p) => p.name === n)!.id;
  const actAs = (n: string) => a.c.from("members").update({ active_person_id: id(n) }).eq("workspace_id", a.ws).eq("user_id", a.uid);

  check("visitor B cannot read visitor A's workspace", ((await b.c.from("rules").select("id").eq("workspace_id", a.ws)).data ?? []).length === 0);
  check("visitor B cannot read visitor A's people", ((await b.c.from("people").select("id").eq("workspace_id", a.ws)).data ?? []).length === 0);

  await actAs("Arjun");
  const factsCreator = (await a.c.from("facts").select("code, restricted").eq("workspace_id", a.ws)).data!;
  check("creator cannot see confidential facts", factsCreator.length > 0 && !factsCreator.some((f) => f.restricted));
  check("creator cannot edit rules", ((await a.c.from("rules").update({ severity: "minor" }).eq("workspace_id", a.ws).select("id")).data ?? []).length === 0);
  check("creator cannot add facts", !!(await a.c.from("facts").insert({ workspace_id: a.ws, code: "F-99", statement: "x", kind: "text", source: "x", owner: "x" })).error);

  const { data: draft } = await a.c.from("drafts").insert({ workspace_id: a.ws, title: "t", channel: "email", created_by: id("Arjun") }).select("id").single();
  const { data: v } = await a.c.from("draft_versions").insert({ workspace_id: a.ws, draft_id: draft!.id, version: 1, body: "Hi", fingerprint: "f" }).select("id").single();
  check("creator cannot mark a draft approved", ((await a.c.from("drafts").update({ status: "approved" }).eq("id", draft!.id).select("id")).data ?? []).length === 0);
  check("creator cannot create an approval", !!(await a.c.from("approvals").insert({ workspace_id: a.ws, draft_id: draft!.id, draft_version_id: v!.id, fingerprint: "f", rulebook_version: 1 })).error);
  check("creator cannot record an override", !!(await a.c.from("decisions").insert({ workspace_id: a.ws, draft_id: draft!.id, rule_code: "TONE-04", action: "override" })).error);
  check("creator cannot switch to a person in another workspace", ((await a.c.from("members").update({ active_person_id: (await b.c.from("people").select("id").eq("workspace_id", b.ws).limit(1)).data![0].id }).eq("workspace_id", a.ws).select("user_id")).data ?? []).length === 0);

  // Governance: the workflow must not be bypassable by talking to the database directly.
  const { data: run } = await a.c.from("check_runs").insert({ workspace_id: a.ws, draft_version_id: v!.id, rulebook_version: 1, fingerprint: "f" }).select("id").maybeSingle();
  check("creator cannot write check runs directly", !run);
  const admin0 = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: realRun } = await admin0.from("check_runs").insert({ workspace_id: a.ws, draft_version_id: v!.id, rulebook_version: 1, fingerprint: "f" }).select("id").single();
  const { data: blocker } = await admin0.from("findings").insert({ workspace_id: a.ws, draft_id: draft!.id, draft_version_id: v!.id, check_run_id: realRun!.id, category: "claims", severity: "blocker", rule_code: "CLAIM-02", quote: "#1", message: "x", label: "code" }).select("id").single();
  check("creator cannot insert findings directly", !!(await a.c.from("findings").insert({ workspace_id: a.ws, draft_id: draft!.id, draft_version_id: v!.id, check_run_id: realRun!.id, category: "claims", severity: "minor", rule_code: "X", quote: "x", message: "x", label: "code" })).error);
  check("creator cannot mark a blocker accepted without fixing it", ((await a.c.from("findings").update({ status: "accepted" }).eq("id", blocker!.id).select("id")).data ?? []).length === 0);
  check("creator cannot push a draft into review directly", ((await a.c.from("drafts").update({ status: "in_review" }).eq("id", draft!.id).select("id")).data ?? []).length === 0);
  const token = `t-${Date.now()}`;
  await a.c.from("drafts").insert({ workspace_id: a.ws, title: "once", channel: "email", created_by: id("Arjun"), client_token: token });
  const again = await a.c.from("drafts").insert({ workspace_id: a.ws, title: "twice", channel: "email", created_by: id("Arjun"), client_token: token });
  check("the same New draft form token cannot create a second draft", again.error?.code === "23505");
  check("creator cannot rewrite a checked version", ((await a.c.from("draft_versions").update({ body: "tampered" }).eq("id", v!.id).select("id")).data ?? []).length === 0);

  await actAs("Ritu");
  const factsReviewer = (await a.c.from("facts").select("code, restricted").eq("workspace_id", a.ws)).data!;
  check("reviewer can see confidential facts", factsReviewer.some((f) => f.restricted));
  check("reviewer cannot create an approval directly, only through the app's checks", !!(await a.c.from("approvals").insert({ workspace_id: a.ws, draft_id: draft!.id, draft_version_id: v!.id, fingerprint: "f", rulebook_version: 1 })).error);

  // Records that insights and the audit trail are built from cannot be forged.
  check("visitor cannot write an audit event in someone else's name", !!(await a.c.from("events").insert({ workspace_id: a.ws, type: "draft.approved", person_id: id("Ritu") })).error);
  check("visitor cannot write a comment in someone else's name", !!(await a.c.from("comments").insert({ workspace_id: a.ws, draft_id: draft!.id, person_id: id("Meera"), body: "Looks fine to me" })).error);
  check("visitor cannot add fake disputes to make a rule look unclear", !!(await a.c.from("decisions").insert({ workspace_id: a.ws, draft_id: draft!.id, rule_code: "TONE-04", action: "dispute", reason: "x" })).error);

  await admin0.from("events").insert({ workspace_id: a.ws, type: "test" });
  const before = (await a.c.from("events").select("id").eq("workspace_id", a.ws)).data!.length;
  await a.c.from("events").delete().eq("workspace_id", a.ws);
  await a.c.from("events").update({ type: "tampered" }).eq("workspace_id", a.ws);
  const after = (await a.c.from("events").select("id, type").eq("workspace_id", a.ws)).data!;
  check("audit trail cannot be deleted or edited", after.length === before && !after.some((e) => e.type === "tampered"));
  check("AI result store is not readable by visitors", ((await a.c.from("check_cache").select("key").limit(1)).data ?? []).length === 0);
  check("AI usage counter cannot be called by visitors", !!(await a.c.rpc("take_ai_request", { p_scope: "x", p_limit: 999 })).error);

  // Documents (PDFs) are in a private bucket: only the server reads them or hands out one-time upload links.
  const { createClient: adminClient } = await import("@supabase/supabase-js");
  const server = adminClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const docPath = `${a.ws}/00000000-0000-4000-8000-000000000000.pdf`;
  await server.storage.from("documents").upload(docPath, new TextEncoder().encode("%PDF-1.4 test"), { contentType: "application/pdf", upsert: true });
  check("visitor cannot download a stored document directly", !!(await a.c.storage.from("documents").download(docPath)).error);
  check("visitor cannot list stored documents", ((await a.c.storage.from("documents").list(a.ws)).data ?? []).length === 0);
  check("visitor cannot make an upload link without the server", !!(await a.c.storage.from("documents").createSignedUploadUrl(`${a.ws}/x.pdf`)).error);
  check("visitor cannot upload a document without a link from the server", !!(await a.c.storage.from("documents").upload(`${a.ws}/y.pdf`, new TextEncoder().encode("%PDF-1.4"), { contentType: "application/pdf" })).error);
  await server.storage.from("documents").remove([docPath]);

  // clean up the two test workspaces
  const { createClient: admin } = await import("@supabase/supabase-js");
  await admin(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!).from("workspaces").delete().in("id", [a.ws, b.ws]);
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll access rules hold.");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
