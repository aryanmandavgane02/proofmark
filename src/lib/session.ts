import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Person = { id: string; name: string; title: string; role: "creator" | "manager" | "reviewer"; reviewer_area: "legal" | "design" | null };
export type Workspace = { id: string; name: string; brand_name: string; is_demo: boolean; code_checks_only: boolean; rulebook_version: number };

/** The visitor's workspace and the person they are currently acting as, or null if they have none. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: member } = await supabase
    .from("members")
    .select("workspace_id, active_person_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!member) return { supabase, user: auth.user, workspace: null, person: null, people: [] as Person[] };
  const [{ data: workspace }, { data: people }] = await Promise.all([
    supabase.from("workspaces").select("id, name, brand_name, is_demo, code_checks_only, rulebook_version").eq("id", member.workspace_id).single(),
    supabase.from("people").select("id, name, title, role, reviewer_area").eq("workspace_id", member.workspace_id).order("sort"),
  ]);
  const list = (people ?? []) as Person[];
  return {
    supabase,
    user: auth.user,
    workspace: workspace as Workspace,
    person: list.find((p) => p.id === member.active_person_id) ?? list[0],
    people: list,
  };
});

/** Same as getSession, but sends visitors without a workspace back to the landing page. */
export async function requireSession() {
  const s = await getSession();
  if (!s?.workspace || !s.person) redirect("/");
  return s as typeof s & { workspace: Workspace; person: Person };
}
