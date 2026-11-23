import { requireSession } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { todayIST } from "@/lib/pipeline";
import { ColorForm, FactForm, TermForm, TypefaceForm, type FactRow } from "./BrandForms";
import { removeTypeface } from "@/app/brand-actions";
import { recheckFactAlerts } from "@/app/actions";
import { PendingButton } from "../drafts/[id]/PendingButton";
import Link from "next/link";
import { Fragment } from "react";
import { approvedContent, syncExpiredFacts, usage, type FactRow as FactShapeRow } from "@/lib/alerts-server";
import { AlertList, FactChange, type AlertView } from "../AlertList";

// Saving facts may re-check approved content.
export const maxDuration = 60;

export default async function Facts(props: PageProps<"/app/facts">) {
  const sp = await props.searchParams;
  const s = await requireSession();
  await syncExpiredFacts(s.workspace.id, todayIST());
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 300);
  const prefill = sp.add ? { statement: one(sp.statement) ?? "", value: one(sp.value) ?? "", unit: one(sp.unit) ?? "" } : undefined;
  const [{ data: facts }, { data: terms }, { data: assets }, { data: alerts }, content] = await Promise.all([
    s.supabase.from("facts").select("*").eq("workspace_id", s.workspace.id).order("code"),
    s.supabase.from("terms").select("*").eq("workspace_id", s.workspace.id),
    s.supabase.from("assets").select("*").eq("workspace_id", s.workspace.id),
    s.supabase.from("fact_alerts").select("*, draft:drafts(title, is_sample, status)").eq("workspace_id", s.workspace.id).eq("status", "open").order("created_at", { ascending: false }),
    approvedContent(s.workspace.id),
  ]);
  // Where approved content relies on each fact (the visitor sees only the facts their role may see).
  const usedIn = usage((facts ?? []) as FactShapeRow[], content);
  const canDecide = s.person.role !== "creator";
  const today = todayIST();
  const manager = s.person.role === "manager";
  const nextCode = `F-${Math.max(9, ...(facts ?? []).map((f) => Number(String(f.code).replace("F-", "")) || 0)) + 1}`;
  return (
    <>
      <PageTitle
        title="Facts, terms and assets"
        subtitle={<>Claims in a draft are checked against these approved facts, and numbers are compared by code. {s.person.role === "creator" && <b>Some confidential facts are hidden from creators.</b>}</>}
      />
      <h2 className="mb-2 text-sm font-semibold text-primary-d">Fact ledger</h2>
      {manager ? (
        <details className="mb-3" open={!!prefill} id="add-fact"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a fact</summary>
          {prefill && <p className="mt-2 text-sm text-muted">Pre-filled from a claim writers keep making (Insights). Check the wording, then add a real source and owner.</p>}
          <div className="mt-2"><FactForm nextCode={nextCode} prefill={prefill} /></div></details>
      ) : (
        <p className="mb-3 text-sm text-muted">Only the brand manager (Meera) adds or edits facts.</p>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-d text-left text-white">
            <tr><th className="p-2.5">Code</th><th className="p-2.5">Approved fact</th><th className="p-2.5">Source</th><th className="p-2.5">Owner</th><th className="p-2.5">Valid until</th><th className="p-2.5">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(facts ?? []).map((f) => {
              const expired = f.status === "expired" || (f.expires_on && f.expires_on < today);
              const used = usedIn.get(f.code) ?? [];
              const open = ((alerts ?? []) as AlertView[]).filter((a) => a.fact_code === f.code);
              const recheckable = open.filter((a) => a.kind !== "expiring").length;
              // The old and new wording, once for the fact when every alert is about the same change.
              const changes = [...new Map(open.filter((a) => a.kind === "changed" && a.before && a.after).map((a) => [`${a.before!.statement}\n${a.after!.statement}`, a])).values()];
              return (
                <Fragment key={f.code}>
                <tr id={`fact-${f.code}`} className={`scroll-mt-24 ${expired ? "text-muted" : ""}`}>
                  <td className="p-2.5 font-mono font-bold">{f.code}</td>
                  <td className="p-2.5">
                    {f.statement} {f.restricted && <span className="ml-1 rounded bg-[#ffecc7] px-1.5 text-xs text-[#7a3d00]">Confidential</span>}
                    {used.length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs font-semibold text-primary">Used in {used.length} approved draft{used.length === 1 ? "" : "s"}</summary>
                        <ul className="mt-1 space-y-1 text-xs">
                          {used.map((u) => (
                            <li key={u.draft_id}>
                              <Link href={`/app/drafts/${u.draft_id}`} className="font-semibold text-primary hover:underline">{u.title}</Link>{u.is_sample && <span className="ml-1 text-muted">(sample)</span>}:{" "}
                              {u.evidence.slice(0, 2).map((e, i) => <span key={i}>{i > 0 && ", "}&ldquo;{e.quote.length > 70 ? `${e.quote.slice(0, 70)}…` : e.quote}&rdquo;{e.page ? ` (page ${e.page})` : ""}</span>)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <p className="mt-1 text-xs text-muted">{open.length ? "No approved draft matches it as it is now; drafts that relied on it before are listed below." : "Not used in approved content."}</p>
                    )}
                    {manager && <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-primary">Edit</summary><div className="mt-2"><FactForm fact={{ ...f, value: f.value == null ? null : Number(f.value) } as FactRow} /></div></details>}
                  </td>
                  <td className="p-2.5">{f.source}</td>
                  <td className="p-2.5">{f.owner}</td>
                  <td className="p-2.5">{f.expires_on ?? "—"}</td>
                  <td className="p-2.5">{expired ? "Expired" : "Current"}</td>
                </tr>
                {open.length > 0 && (
                  <tr className="bg-[#fff6f4]">
                    <td colSpan={6} className="px-3 pb-2 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#8a1c12]">
                          {open.length} approved draft{open.length === 1 ? "" : "s"} may be out of date because {f.code} {open[0].kind === "changed" ? "changed" : open[0].kind === "expired" ? "ended" : "is ending"}
                        </p>
                        {recheckable > 1 && (
                          <form action={recheckFactAlerts}>
                            <input type="hidden" name="fact_code" value={f.code} />
                            <input type="hidden" name="back" value={`/app/facts#fact-${f.code}`} />
                            <PendingButton className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110" pendingText="Re-checking all…">Re-check all {recheckable}</PendingButton>
                          </form>
                        )}
                      </div>
                      {changes.length === 1 && <FactChange before={changes[0].before!} after={changes[0].after!} />}
                      <AlertList alerts={open} canDecide={canDecide} back={`/app/facts#fact-${f.code}`} showFact={false} showChange={changes.length !== 1} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Glossary (rule TERM-01)</h2>
      {manager && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a term</summary><div className="mt-2"><TermForm /></div></details>}
      <Card className="divide-y divide-line">
        {(terms ?? []).map((t) => (
          <div key={t.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[180px_1fr_1fr]">
            <span className="font-semibold text-[#0a5c4f]">Use: {t.preferred}</span>
            <span className="text-red">Avoid: {t.avoid.join(", ")}</span>
            <span className="text-muted">{t.reason}</span>
          </div>
        ))}
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Brand palette (rule VIS-02)</h2>
      {manager && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a colour</summary><div className="mt-2"><ColorForm /></div></details>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(assets ?? []).filter((a) => a.kind === "color").map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <div className="h-16" style={{ background: a.hex }} />
            <div className="p-2.5 text-sm"><b>{a.name}</b> <span className="font-mono text-muted">{a.hex}</span></div>
          </Card>
        ))}
      </div>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Typefaces (rule VIS-03, checked in PDF documents)</h2>
      {manager && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a typeface</summary><div className="mt-2"><TypefaceForm /></div></details>}
      <Card className="divide-y divide-line">
        {(assets ?? []).filter((a) => a.kind === "font").map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="font-semibold text-ink">{a.name}</span>
            <span className="text-muted">{a.note || "Any text"}</span>
            {manager && (
              <form action={removeTypeface} className="ml-auto">
                <input type="hidden" name="id" value={a.id} />
                <PendingButton className="text-xs font-semibold text-muted underline hover:text-red" pendingText="Removing…">Remove</PendingButton>
              </form>
            )}
          </div>
        ))}
        {!(assets ?? []).some((a) => a.kind === "font") && <p className="p-3 text-sm text-muted">No typefaces yet, so the typeface check has nothing to compare documents with.</p>}
      </Card>
      <p className="mt-2 text-xs text-muted">A font in a PDF counts as a brand typeface when its family matches, in any weight or style (for example “Poppins-Bold”). Icon and emoji fonts are ignored.</p>
    </>
  );
}
