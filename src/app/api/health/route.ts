// Deployment check: reports which settings are present (never their values) and whether the
// database answers. A scheduled GitHub job calls it so the free database is never paused for inactivity.
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
  const env = Object.fromEntries(keys.map((k) => [k, Boolean(process.env[k])]));
  let db = false;
  try {
    const { error } = await createAdminClient().from("workspaces").select("id", { head: true, count: "exact" }).limit(1);
    db = !error;
  } catch {
    db = false;
  }
  return Response.json({ ok: Object.values(env).every(Boolean) && db, env, db }, { status: db ? 200 : 503 });
}
