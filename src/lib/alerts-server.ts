import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { factLabel, reliance, type Evidence, type FactShape } from "@/lib/alerts";
import type { DocPage } from "@/lib/checks/types";

// Raising outdated-content alerts. Written with the server key, always scoped to one workspace that the caller has
// already checked (the visitor's own, through their session); visitors can read alerts but never write them.

export type FactRow = FactShape & { expires_on: string | null; restricted?: boolean };
export type ApprovedVersion = {
  draft_id: string; title: string; channel: string; owner_id: string | null; is_sample: boolean;
  version_id: string; version: number; body: string; pages: DocPage[] | null;
};

/** The current version of every approved draft in a workspace: the content alerts protect. */
export async function approvedContent(workspaceId: string): Promise<ApprovedVersion[]> {
  const db = createAdminClient();
  const { data: drafts } = await db.from("drafts").select("id, title, channel, created_by, is_sample, current_version").eq("workspace_id", workspaceId).eq("status", "approved");
  if (!drafts?.length) return [];
  const { data: versions } = await db.from("draft_versions").select("id, draft_id, version, body, pages").eq("workspace_id", workspaceId).in("draft_id", drafts.map((d) => d.id));
  return drafts.flatMap((d) => {
    const v = (versions ?? []).find((x) => x.draft_id === d.id && x.version === d.current_version);
    return v ? [{ draft_id: d.id, title: d.title, channel: d.channel, owner_id: d.created_by, is_sample: d.is_sample, version_id: v.id, version: v.version, body: v.body, pages: v.pages }] : [];
  });
}

/** Each fact's approved drafts and where they rely on it, for the Facts page ("Used in 5 approved drafts"). */
export function usage(facts: FactRow[], content: ApprovedVersion[]) {
  return new Map(facts.map((f) => [f.code, content.flatMap((c) => {
    const ev = reliance(f, c.body, c.pages ?? undefined, facts, "any");
    return ev.length ? [{ ...c, evidence: ev }] : [];
  })]));
}

const pick = (f: FactRow) => ({ code: f.code, statement: f.statement, value: f.value == null ? null : Number(f.value), unit: f.unit, expires_on: f.expires_on });
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const list = (titles: string[]) => titles.map((t) => `“${t}”`).join(", ");

export type Raised = { count: number; drafts: { id: string; title: string }[] };

/**
 * Raises one alert for every approved draft that relies on a fact, with the evidence, and tells each draft's owner.
 * `fact` is the fact as the drafts relied on it (before a change); `now` is the fact after it. Raising the same trigger
 * twice changes nothing (one alert per version, fact and trigger), so a double click or two open tabs are safe.
 */
export async function raiseAlerts(p: {
  workspaceId: string; fact: FactRow; now: FactRow; facts: FactRow[]; kind: "changed" | "expiring" | "expired";
  trigger: string; how: "value" | "any"; by: string | null;
}): Promise<Raised> {
  // Confidential facts never raise alerts: alerts and notifications quote the fact, and creators can read them.
  if (p.fact.restricted || p.now.restricted) return { count: 0, drafts: [] };
  const db = createAdminClient();
  const content = await approvedContent(p.workspaceId);
  const hits = content
    .map((c) => ({ c, evidence: reliance(p.fact, c.body, c.pages ?? undefined, p.facts, p.how) }))
    .filter((x) => x.evidence.length > 0);
  if (!hits.length) return { count: 0, drafts: [] };
  const rows = hits.map(({ c, evidence }) => ({
    workspace_id: p.workspaceId, fact_code: p.fact.code, kind: p.kind, trigger: p.trigger, draft_id: c.draft_id, draft_version_id: c.version_id,
    owner_id: c.owner_id, before: pick(p.fact), after: pick(p.now), evidence: evidence.slice(0, 10) as Evidence[],
    due_on: p.kind === "expiring" ? p.now.expires_on : null, created_by: p.by,
  }));
  const { data: inserted } = await db.from("fact_alerts").upsert(rows, { onConflict: "draft_version_id,fact_code,trigger", ignoreDuplicates: true }).select("draft_id");
  const fresh = new Set((inserted ?? []).map((r) => r.draft_id));
  const raised = hits.filter((h) => fresh.has(h.c.draft_id));
  if (!raised.length) return { count: 0, drafts: [] };

  // One notification per owner, naming their drafts.
  const byOwner = new Map<string, ApprovedVersion[]>();
  for (const { c } of raised) if (c.owner_id) byOwner.set(c.owner_id, [...(byOwner.get(c.owner_id) ?? []), c]);
  const what = p.kind === "changed"
    ? `Fact ${p.fact.code} changed: it now says “${factLabel(p.now)}”.`
    : p.kind === "expiring"
      ? `Fact ${p.fact.code} (“${factLabel(p.now)}”) ends after ${day(p.now.expires_on!)}.`
      : `Fact ${p.fact.code} (“${factLabel(p.now)}”) ended on ${day(p.now.expires_on!)}.`;
  const [one, many] = p.kind === "changed"
    ? (p.how === "value" ? ["quotes its old value", "quote its old value"] : ["relies on its old wording", "rely on its old wording"])
    : p.kind === "expiring" ? ["mentions it", "mention it"] : ["still mentions it", "still mention it"];
  const notes = [...byOwner].map(([owner, mine]) => ({
    workspace_id: p.workspaceId, person_id: owner,
    text: `${what} Your approved ${mine.length === 1 ? "draft" : "drafts"} ${list(mine.map((m) => m.title))} ${mine.length === 1 ? one : many}. ${p.kind === "expiring" ? "Re-check before then." : "Re-check in one click."}`.slice(0, 500),
    link: mine.length === 1 ? `/app/drafts/${mine[0].draft_id}` : "/app/insights#outdated",
  }));
  if (notes.length) await db.from("notifications").insert(notes);
  await db.from("events").insert({
    workspace_id: p.workspaceId, person_id: p.by, type: "alerts.raised",
    detail: { fact: p.fact.code, kind: p.kind, count: raised.length, drafts: raised.map((r) => r.c.title) },
  });
  return { count: raised.length, drafts: raised.map((r) => ({ id: r.c.draft_id, title: r.c.title })) };
}

/**
 * A fact's end date was set or changed (or has passed): approved drafts that mention it get "ends soon" alerts with the
 * date, or "ended" alerts once the date has passed. Older "ends soon" alerts for the fact are replaced.
 */
export async function raiseExpiry(workspaceId: string, fact: FactRow, facts: FactRow[], today: string, by: string | null): Promise<Raised & { kind: "expiring" | "expired" }> {
  const db = createAdminClient();
  const ended = !!fact.expires_on && fact.expires_on < today;
  await db.from("fact_alerts")
    .update({ status: "superseded", outcome: ended ? "The fact has now ended; see the newer alert." : `The end date changed to ${fact.expires_on ?? "none"}; see the newer alert.`, resolved_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId).eq("fact_code", fact.code).eq("kind", "expiring").eq("status", "open").neq("trigger", `expiring:${fact.expires_on}`);
  if (!fact.expires_on) return { count: 0, drafts: [], kind: "expiring" };
  const kind = ended ? "expired" : "expiring";
  const r = await raiseAlerts({ workspaceId, fact, now: fact, facts, kind, trigger: `${kind}:${fact.expires_on}`, how: "any", by });
  if (ended) await db.from("facts").update({ expiry_alerted_on: fact.expires_on }).eq("workspace_id", workspaceId).eq("code", fact.code);
  return { ...r, kind };
}

/**
 * Facts whose last valid day has passed raise "expired" alerts once (the expiry date is remembered on the fact).
 * Runs when people open the app, so no scheduled job is needed. Never throws: a failure only delays the alerts.
 */
export async function syncExpiredFacts(workspaceId: string, today: string): Promise<number> {
  try {
    const db = createAdminClient();
    const { data: all } = await db.from("facts").select("code, statement, kind, value, unit, keywords, expires_on, expiry_alerted_on, restricted").eq("workspace_id", workspaceId);
    const due = (all ?? []).filter((f) => f.expires_on && f.expires_on < today && f.expiry_alerted_on !== f.expires_on);
    let raised = 0;
    for (const f of due) raised += (await raiseExpiry(workspaceId, f as FactRow, (all ?? []) as FactRow[], today, null)).count;
    return raised;
  } catch {
    return 0;
  }
}

/** Closes an alert once, from "open" only: a double click or a second tab changes nothing the second time. */
export async function closeAlert(workspaceId: string, alertId: string, status: "still_correct" | "sent_back" | "superseded", outcome: string, by: string | null) {
  const { data } = await createAdminClient().from("fact_alerts")
    .update({ status, outcome, resolved_by: by, resolved_at: new Date().toISOString() })
    .eq("id", alertId).eq("workspace_id", workspaceId).eq("status", "open").select("id");
  return (data ?? []).length > 0;
}

export async function notify(workspaceId: string, personId: string | null, text: string, link: string | null) {
  if (!personId) return;
  await createAdminClient().from("notifications").insert({ workspace_id: workspaceId, person_id: personId, text: text.slice(0, 500), link });
}

/** Open alerts show the fact as it is now, also after a second edit. */
export async function refreshOpenAlerts(workspaceId: string, fact: FactRow) {
  await createAdminClient().from("fact_alerts").update({ after: pick(fact) }).eq("workspace_id", workspaceId).eq("fact_code", fact.code).eq("status", "open");
}
