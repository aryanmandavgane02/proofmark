// Outdated-content alerts with their actions: re-check in one click (decided by the checks), or a reviewer's decision
// where code cannot judge. Used on the Facts page (per fact), on Insights and on the draft page.
import Link from "next/link";
import { decideAlert, recheckAlert } from "@/app/actions";
import { PendingButton } from "./drafts/[id]/PendingButton";

export type AlertView = {
  id: string; fact_code: string; kind: "changed" | "expiring" | "expired"; draft_id: string; status: string; outcome: string | null; due_on: string | null;
  before: { statement: string } | null; after: { statement: string; expires_on: string | null } | null;
  evidence: { quote: string; page: number | null; how: string }[];
  draft: { title: string; is_sample: boolean; status: string } | null;
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function KindChip({ a }: { a: AlertView }) {
  const [text, cls] = a.kind === "changed"
    ? ["Fact changed", "bg-[#fde0dd] text-[#8a1c12]"]
    : a.kind === "expired"
      ? ["Fact ended", "bg-[#fde0dd] text-[#8a1c12]"]
      : [`Ends after ${a.due_on ? day(a.due_on) : "its date"}`, "bg-[#ffecc7] text-[#7a3d00]"];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

const STATUS: Record<string, [string, string]> = {
  sent_back: ["Sent back for changes", "text-[#8a1c12]"],
  still_correct: ["Still correct", "text-accent"],
  superseded: ["Replaced", "text-muted"],
};

export function AlertList({ alerts, canDecide, back, showFact = true }: { alerts: AlertView[]; canDecide: boolean; back: string; showFact?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {alerts.map((a) => {
        const open = a.status === "open";
        const needsPerson = open && (a.kind === "expiring" || !!a.outcome);
        return (
          <li key={a.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <KindChip a={a} />
              {showFact && <span className="font-mono text-xs font-bold">{a.fact_code}</span>}
              <Link href={`/app/drafts/${a.draft_id}`} className="font-semibold text-primary hover:underline">{a.draft?.title ?? "A draft"}</Link>
              {a.draft?.is_sample && <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">Sample</span>}
              {!open && <span className={`ml-auto text-xs font-semibold ${STATUS[a.status]?.[1] ?? ""}`}>{STATUS[a.status]?.[0] ?? a.status}</span>}
            </div>
            <p className="mt-1 text-ink">
              {a.evidence.slice(0, 3).map((e, i) => (
                <span key={i}>{i > 0 && ", "}&ldquo;{e.quote.length > 90 ? `${e.quote.slice(0, 90)}…` : e.quote}&rdquo;{e.page ? ` (page ${e.page})` : ""}</span>
              ))}
              {a.evidence.length > 3 && <span className="text-muted"> and {a.evidence.length - 3} more</span>}
            </p>
            {a.kind === "changed" && a.before && a.after && (
              <p className="mt-1 text-xs text-muted">Was &ldquo;{a.before.statement}&rdquo; → now &ldquo;{a.after.statement}&rdquo;</p>
            )}
            {a.outcome && <p className={`mt-1 text-xs ${open ? "text-[#7a3d00]" : "text-muted"}`}>{a.outcome}</p>}
            {open && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {a.kind !== "expiring" && (
                  <form action={recheckAlert}>
                    <input type="hidden" name="alert_id" value={a.id} />
                    <input type="hidden" name="back" value={back} />
                    <PendingButton className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110" pendingText="Re-checking…">Re-check</PendingButton>
                  </form>
                )}
                {needsPerson && canDecide && (
                  <>
                    <form action={decideAlert}>
                      <input type="hidden" name="alert_id" value={a.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="decision" value="still_correct" />
                      <PendingButton className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-primary-d hover:bg-soft" pendingText="Saving…">Still correct</PendingButton>
                    </form>
                    <form action={decideAlert}>
                      <input type="hidden" name="alert_id" value={a.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="decision" value="send_back" />
                      <PendingButton className="rounded-lg border border-red/40 px-3 py-1.5 text-xs font-semibold text-red hover:bg-red/5" pendingText="Sending back…">Send back for changes</PendingButton>
                    </form>
                  </>
                )}
                {needsPerson && !canDecide && <span className="text-xs text-muted">A reviewer or the brand manager decides this one.</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
