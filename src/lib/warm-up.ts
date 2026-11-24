import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wakes the database, the sign-in service and file storage in the background when someone opens the home page. After a
 * quiet spell these services are idle, and the first "Start the live demo" used to wait several seconds for them; the
 * visitor now spends that time reading the page instead. Runs after the page has been sent, never throws, and reads
 * nothing private.
 */
export async function warmUp(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const admin = createAdminClient();
  await Promise.allSettled([
    admin.from("workspaces").select("id", { head: true }).limit(1),
    admin.storage.from("documents").list("library", { limit: 1 }),
    fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(5_000) }),
  ]);
}
