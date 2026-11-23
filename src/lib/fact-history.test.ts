import { describe, expect, it } from "vitest";
import { alertOutcome, factHistory, type FactEvent, type HistoryAlert } from "./fact-history";

const nameOf = (id: string | null) => (id === "m" ? "Meera" : null);
let n = 0;
const alert = (over: Partial<HistoryAlert>): HistoryAlert => ({
  id: `a${n++}`, fact_code: "F-12", kind: "changed", trigger: "changed:2026-11-23T10:00:01.000Z", status: "open", created_at: "2026-11-23T10:00:01.500Z",
  draft_id: "d", draft: { title: "About us page" }, due_on: null, before: { statement: "35,000+ customers" }, after: { statement: "30,000+ customers" }, ...over,
});
const edit = (at: string, code: string, from: string, to: string): FactEvent => ({ type: "fact.edited", person_id: "m", created_at: at, detail: { code, from: { statement: from }, to: { statement: to } } });

describe("fact history", () => {
  it("lists each change newest first, with the drafts it affected and what happened to each", () => {
    const events = [
      edit("2026-11-23T10:00:00.000Z", "F-12", "35,000+ customers", "30,000+ customers"),
      edit("2026-11-23T11:00:00.000Z", "F-12", "30,000+ customers", "32,000+ customers"),
      edit("2026-11-23T10:30:00.000Z", "F-11", "4.6 stars", "4.7 stars"),
    ];
    const h = factHistory("F-12", events, [alert({ status: "sent_back" }), alert({ draft: { title: "Thank-you post" }, status: "still_correct" })], nameOf);
    expect(h.map((i) => i.text)).toEqual([
      "Changed fact F-12 from “30,000+ customers” to “32,000+ customers”.",
      "Changed fact F-12 from “35,000+ customers” to “30,000+ customers”.",
    ]);
    expect(h[1].who).toBe("Meera");
    expect(h[1].alerts.map((a) => `${a.draft!.title}: ${alertOutcome(a)}`)).toEqual(["About us page: sent back for changes", "Thank-you post: still correct; the approval stands"]);
    expect(h[0].alerts).toHaveLength(0);
  });

  it("shows a fact that ended by date on its own, with the drafts that mention it", () => {
    const h = factHistory("F-14", [], [alert({ fact_code: "F-14", kind: "expired", trigger: "expired:2026-10-20", due_on: "2026-10-20", draft: { title: "Diwali offer email" } })], nameOf);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ who: null, text: "The fact ended on 20 Oct 2026." });
    expect(alertOutcome(h[0].alerts[0])).toBe("open: waiting for a re-check");
  });

  it("describes edits recorded before old and new values were kept, and end dates", () => {
    const old: FactEvent = { type: "fact.edited", person_id: "m", created_at: "2026-11-22T09:00:00.000Z", detail: { code: "F-12" } };
    const ends: FactEvent = { type: "fact.edited", person_id: "m", created_at: "2026-11-22T09:30:00.000Z", detail: { code: "F-12", from: { statement: "x", expires_on: null }, to: { statement: "x", expires_on: "2026-12-31" } } };
    expect(factHistory("F-12", [old, ends], [], nameOf).map((i) => i.text)).toEqual(["Set fact F-12 to end after 31 Dec 2026.", "Edited fact F-12."]);
  });
});
