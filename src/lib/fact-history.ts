// The history of one fact: every edit (who, when, the old and new wording), and under each change the approved drafts
// it affected, with what happened to each. Added after user tests in Round 3 ("a visible history of changes to facts,
// with the drafts affected"). Pure, so it is unit-tested; the Facts page passes in the events and alerts it loaded.
import { describeEvent } from "./events";

export type FactEvent = { type: string; person_id: string | null; detail: Record<string, unknown>; created_at: string };
export type HistoryAlert = {
  id: string; fact_code: string; kind: "changed" | "expiring" | "expired"; trigger: string; status: string; created_at: string;
  draft_id: string; draft: { title: string } | null; due_on: string | null;
  before: { statement: string } | null; after: { statement: string; expires_on?: string | null } | null;
};
export type HistoryItem = { at: string; who: string | null; text: string; alerts: HistoryAlert[] };

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** What happened to one affected draft, in a few words. */
export function alertOutcome(a: HistoryAlert): string {
  if (a.status === "sent_back") return "sent back for changes";
  if (a.status === "still_correct") return "still correct; the approval stands";
  if (a.status === "superseded") return "replaced by a newer version, which was checked again";
  return a.kind === "expiring" ? "open: to update before the fact ends" : "open: waiting for a re-check";
}

/** A change no edit explains: the fact ended by date, or an alert from before edits were recorded. */
function standalone(a: HistoryAlert): string {
  const date = a.due_on ?? a.trigger.split(":")[1] ?? a.created_at;
  if (a.kind === "expired") return `The fact ended on ${day(date)}.`;
  if (a.kind === "expiring") return `The fact was set to end after ${day(date)}.`;
  return a.before && a.after ? `The fact changed from “${a.before.statement}” to “${a.after.statement}”.` : "The fact changed.";
}

/** Newest first. Alerts raised together share a trigger; each group goes under the edit made just before it. */
export function factHistory(code: string, events: FactEvent[], alerts: HistoryAlert[], nameOf: (id: string | null) => string | null): HistoryItem[] {
  const items: HistoryItem[] = events
    .filter((e) => (e.type === "fact.edited" || e.type === "fact.added") && e.detail.code === code)
    .map((e) => {
      const text = describeEvent(e.type, e.detail);
      return { at: e.created_at, who: nameOf(e.person_id), text: text.charAt(0).toUpperCase() + text.slice(1), alerts: [] };
    });
  const edits = [...items];
  const groups = new Map<string, HistoryAlert[]>();
  for (const a of alerts) if (a.fact_code === code) groups.set(a.trigger, [...(groups.get(a.trigger) ?? []), a]);
  for (const group of groups.values()) {
    const at = group.reduce((first, a) => (a.created_at < first ? a.created_at : first), group[0].created_at);
    const t = Date.parse(at);
    // The edit logged in the same save, a moment before its alerts (an ended fact has no edit: the date passed).
    const edit = group[0].kind === "expired" ? undefined : edits
      .filter((i) => Date.parse(i.at) <= t + 5_000 && t - Date.parse(i.at) < 120_000)
      .sort((x, y) => Date.parse(y.at) - Date.parse(x.at))[0];
    if (edit) edit.alerts.push(...group);
    else items.push({ at, who: null, text: standalone(group[0]), alerts: group });
  }
  return items.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}
