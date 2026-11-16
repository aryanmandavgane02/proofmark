import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, CategoryChip, PageTitle, btn, input, timeAgo } from "@/components/ui";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import { UNCLEAR, type InsightRecord } from "@/lib/insights";
import { loadInsights } from "@/lib/insights-data";
import { acceptWording, keepWording, proposeWording } from "@/app/insight-actions";
import { PendingButton } from "../drafts/[id]/PendingButton";

const OUTCOME = (r: InsightRecord) =>
  r.decisions.some((d) => d.action === "override") ? ["Overridden", "bg-[#e3f1e4] text-[#1f5a22]"]
  : r.decisions.some((d) => d.action === "uphold") ? ["Upheld", "bg-[#fde2e0] text-[#8a1c12]"]
  : r.decisions.some((d) => d.action === "dispute") ? ["Disputed, waiting", "bg-[#fff1d6] text-[#7a3d00]"]
  : r.decisions.some((d) => d.action === "accept") ? ["Fix accepted", "bg-soft text-muted"]
  : ["Open", "bg-soft text-muted"];

function Source({ r }: { r: InsightRecord }) {
  return r.sample
    ? <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Sample</span>
    : <Link href={`/app/drafts/${r.draft}`} className="rounded bg-[#e6eefc] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary hover:underline">Yours</Link>;
}

function Bar({ value, max }: { value: number; max: number }) {
  return <span className="block h-2 rounded-full bg-soft" aria-hidden><span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (value / Math.max(1, max)) * 100)}%` }} /></span>;
}

export default async function Insights(props: PageProps<"/app/insights">) {
  const sp = await props.searchParams;
  const view = sp.view === "mine" ? "mine" : "all";
  const msg = typeof sp.msg === "string" ? sp.msg.slice(0, 300) : null;
  const s = await requireSession();
  const manager = s.person.role === "manager";
  const { insights: i, proposals, rulebookVersion, hasReal } = await loadInsights(s, view === "all");
  const who = new Map(s.people.map((p) => [p.id, p.name]));
  const flagged = i.unclear.filter((u) => u.flagged);
  const watching = i.unclear.filter((u) => !u.flagged);
  const clarified = proposals.filter((p) => p.status === "accepted").slice(0, 5);
  const maxRule = i.byRule[0]?.count ?? 1;
  const viewLink = (v: "all" | "mine", label: string) => (
    <Link href={v === "mine" ? "/app/insights?view=mine" : "/app/insights"} aria-current={view === v ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-primary-d text-white" : "text-muted hover:bg-soft"}`}>{label}</Link>
  );

  return (
    <>
      <PageTitle
        title="Insights"
        subtitle="What the team keeps getting wrong, which rules people keep pushing back on, and which claims have no approved fact behind them. Built from every finding and every human decision."
        action={<div className="flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Which history to show">{viewLink("all", "Sample + yours")}{viewLink("mine", "Yours only")}</div>}
      />
      {msg && <p role="status" className="mb-4 rounded-lg border border-accent/40 bg-[#e8f4ec] p-3 text-sm text-[#1f5a22]">{msg}</p>}
      {view === "all" ? (
        <p className="mb-6 rounded-lg bg-soft p-3 text-sm text-muted">
          Includes <b>{i.totals.sample} sample findings</b> from a made-up history of the Urja Bites team (October to early November 2026), marked <i>Sample</i>, so this page is useful on a first visit.
          {" "}{i.totals.yours} finding{i.totals.yours === 1 ? " is" : "s are"} from your own drafts, marked <i>Yours</i>. Choose <b>Yours only</b> to see just your workspace.
        </p>
      ) : !hasReal ? (
        <p className="mb-6 rounded-lg bg-soft p-3 text-sm text-muted">No findings in your workspace yet. <Link className="font-semibold text-primary" href="/app/drafts/new">Check a draft</Link>, or switch to <b>Sample + yours</b>.</p>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [i.totals.findings, "findings"],
          [i.totals.drafts, "drafts checked"],
          [i.totals.accepted, "suggested fixes accepted"],
          [i.totals.overridden, "findings overridden by a reviewer"],
        ].map(([n, label]) => (
          <Card key={String(label)} className="p-4"><p className="text-2xl font-bold text-primary-d">{n}</p><p className="text-xs text-muted">{label}</p></Card>
        ))}
      </div>

      {/* ── Rules that may be unclear ───────────────────────────────── */}
      <section className="mb-10" aria-labelledby="unclear-h">
        <h2 id="unclear-h" className="text-lg font-semibold text-primary-d">Rules that may be unclear</h2>
        <p className="mb-3 text-sm text-muted">
          When people keep disputing a rule and reviewers keep overriding it, the wording is probably the problem, not the writers.
          A rule is flagged at {UNCLEAR.minOverrides} overrides or {UNCLEAR.minDisputes} disputes, when that is at least {UNCLEAR.minShare * 100}% of its findings.
        </p>
        {flagged.length === 0 && <Card className="p-4 text-sm text-muted">No rule is flagged{view === "mine" ? " from your decisions yet. Dispute a finding as a creator, then override it as a reviewer, to see how this works" : ""}.</Card>}
        <div className="space-y-4">
          {flagged.map((u) => {
            const open = proposals.find((p) => p.rule_code === u.rule.code && p.status === "proposed");
            const why = `${u.disputed} disputed and ${u.overridden} overridden findings`;
            return (
              <Card key={u.rule.code} className="border-amber/60 p-5">
                <div id={`rule-${u.rule.code}`} className="scroll-mt-24 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#fff1d6] px-2 py-0.5 text-xs font-bold uppercase text-[#7a3d00]">May be unclear</span>
                  <span className="font-mono font-bold text-primary-d">{u.rule.code}</span><CategoryChip category={u.rule.category} />
                  <span className="font-semibold">{u.rule.title}</span>
                  {u.sampleOnly && <span className="text-xs text-muted">(from sample history)</span>}
                </div>
                <p className="mt-2 text-sm">Current wording: &ldquo;{u.rule.statement}&rdquo;</p>
                <p className="mt-1 text-sm font-semibold text-[#7a3d00]">{u.why}</p>
                <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                  {u.evidence.map((r) => {
                    const [label, cls] = OUTCOME(r);
                    const reasons = r.decisions.filter((d) => d.reason);
                    return (
                      <li key={r.key} className="p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><Source r={r} /><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span><span className="text-muted">{CHANNEL_LABEL[r.channel as Channel]} · {r.draftTitle}</span></div>
                        <p className="mt-1">&ldquo;{r.quote}&rdquo;</p>
                        {reasons.map((d, k) => <p key={k} className="text-muted"><b>{d.by}</b>{d.action === "dispute" ? " disputed" : d.action === "override" ? " overrode" : " upheld"}: {d.reason}</p>)}
                      </li>
                    );
                  })}
                </ul>

                {manager ? (
                  <div className="mt-4 rounded-lg border border-line bg-soft p-4">
                    {u.rule.check_kind !== "ai" && <p className="mb-2 text-xs text-muted">This rule is {u.rule.check_kind === "code" ? "checked by code" : "checked by code and AI"}. New wording changes what writers, reviewers{u.rule.check_kind === "both" ? " and the AI" : ""} read; the code check itself stays the same.</p>}
                    {open ? (
                      <>
                        <p className="text-sm font-semibold text-primary-d">Proposed clearer wording <span className="font-normal text-muted">(drafted by {open.ai_model ?? "AI"} {timeAgo(open.created_at)}; you can edit it)</span></p>
                        {open.rationale && <p className="mt-1 text-sm text-muted">{open.rationale}</p>}
                        <form action={acceptWording} className="mt-2 grid gap-2">
                          <input type="hidden" name="rule_code" value={u.rule.code} /><input type="hidden" name="view" value={view} />
                          <input type="hidden" name="proposal_id" value={open.id} /><input type="hidden" name="why" value={why} />
                          <textarea name="statement" defaultValue={open.statement} rows={3} maxLength={400} className={input} aria-label={`New wording for ${u.rule.code}`} />
                          <div className="flex flex-wrap gap-2">
                            <PendingButton className={btn.accent} pendingText="Publishing…">{`Accept and publish as v${rulebookVersion + 1}`}</PendingButton>
                          </div>
                        </form>
                      </>
                    ) : (
                      <>
                        <form action={proposeWording} className="flex flex-wrap items-center gap-3">
                          <input type="hidden" name="rule_code" value={u.rule.code} /><input type="hidden" name="view" value={view} />
                          <PendingButton className={btn.primary} pendingText="Reading the decisions…">Propose clearer wording</PendingButton>
                          <span className="text-xs text-muted">The AI reads the decisions and reasons above and drafts wording. Nothing changes until you accept.</span>
                        </form>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-primary">Or write it yourself</summary>
                          <form action={acceptWording} className="mt-2 grid gap-2">
                            <input type="hidden" name="rule_code" value={u.rule.code} /><input type="hidden" name="view" value={view} /><input type="hidden" name="why" value={why} />
                            <textarea name="statement" defaultValue={u.rule.statement} rows={3} maxLength={400} className={input} aria-label={`New wording for ${u.rule.code}`} />
                            <div><PendingButton className={btn.accent} pendingText="Publishing…">{`Save and publish as v${rulebookVersion + 1}`}</PendingButton></div>
                          </form>
                        </details>
                      </>
                    )}
                    <form action={keepWording} className="mt-3">
                      <input type="hidden" name="rule_code" value={u.rule.code} /><input type="hidden" name="view" value={view} />
                      <button className="text-sm font-semibold text-muted underline-offset-2 hover:underline">The wording is fine, keep it</button>
                    </form>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">The brand manager can reword this rule from here. Switch to <b>Meera</b> with &ldquo;Acting as&rdquo;.</p>
                )}
              </Card>
            );
          })}
        </div>
        {watching.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Some pushback, below the threshold: {watching.map((u) => `${u.rule.code} (${u.disputed} disputed${u.overridden ? `, ${u.overridden} overridden` : ""} of ${u.total})`).join("; ")}.
          </p>
        )}
        {clarified.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-primary-d">Recently clarified</h3>
            <Card className="divide-y divide-line">
              {clarified.map((p) => (
                <div key={p.id} className="p-3 text-sm">
                  <p><b className="font-mono">{p.rule_code}</b> · rulebook v{p.published_version} · {who.get(p.decided_by ?? "") ?? "—"} {p.decided_at ? timeAgo(p.decided_at) : ""}</p>
                  <p className="text-muted line-through decoration-muted/60">{p.old_statement}</p>
                  <p>{p.statement}</p>
                </div>
              ))}
            </Card>
          </div>
        )}
      </section>

      {/* ── Repeated mistakes ──────────────────────────────────────── */}
      <section className="mb-10" aria-labelledby="mistakes-h">
        <h2 id="mistakes-h" className="text-lg font-semibold text-primary-d">Repeated mistakes</h2>
        <p className="mb-3 text-sm text-muted">Which rules are broken most, and where. A finding found again on a re-check of the same draft counts once.</p>
        {i.byRule.length === 0 ? <Card className="p-4 text-sm text-muted">Nothing yet.</Card> : (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Findings by rule</caption>
                <thead className="text-left text-xs text-muted"><tr><th className="p-2.5">Rule</th><th className="p-2.5">Findings</th><th className="p-2.5 w-1/4"><span className="sr-only">Share</span></th><th className="p-2.5">Drafts</th><th className="p-2.5">Most on</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {i.byRule.map((r) => {
                    const top = Object.entries(r.channels).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <tr key={r.rule.code}>
                        <td className="p-2.5"><span className="font-mono font-bold text-primary-d">{r.rule.code}</span> <span className="text-muted">{r.rule.title}</span></td>
                        <td className="p-2.5 font-semibold">{r.count}{view === "all" && r.yours > 0 && <span className="ml-1 text-xs font-normal text-muted">({r.yours} yours)</span>}</td>
                        <td className="p-2.5"><Bar value={r.count} max={maxRule} /></td>
                        <td className="p-2.5">{r.drafts}</td>
                        <td className="p-2.5 text-muted">{CHANNEL_LABEL[top[0] as Channel]} ({top[1]})</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-primary-d">By category</h3>
                <ul className="space-y-2 text-sm">{i.byCategory.map(([c, n]) => <li key={c} className="grid grid-cols-[110px_1fr_28px] items-center gap-2"><CategoryChip category={c} /><Bar value={n} max={i.byCategory[0][1]} /><span className="text-right font-semibold">{n}</span></li>)}</ul>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-primary-d">By channel</h3>
                <ul className="space-y-2 text-sm">{i.byChannel.map((c) => <li key={c.channel} className="grid grid-cols-[110px_1fr_auto] items-center gap-2"><span>{CHANNEL_LABEL[c.channel as Channel]}</span><Bar value={c.count} max={i.byChannel[0].count} /><span className="text-right text-xs text-muted"><b className="text-sm text-ink">{c.count}</b> in {c.drafts} draft{c.drafts > 1 ? "s" : ""}</span></li>)}</ul>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* ── Claims without a fact ──────────────────────────────────── */}
      <section className="mb-10" aria-labelledby="facts-h">
        <h2 id="facts-h" className="text-lg font-semibold text-primary-d">Claims without a fact</h2>
        <p className="mb-3 text-sm text-muted">Claims writers keep making that no approved fact supports, and figures that keep disagreeing with a fact (the fact may be out of date). Each one is a fact to source, or a claim to stop making.</p>
        {i.missingFacts.length === 0 ? <Card className="p-4 text-sm text-muted">No unsupported claims yet.</Card> : (
          <Card className="divide-y divide-line">
            {i.missingFacts.map((g) => {
              const q = new URLSearchParams({ add: "1", statement: g.kind === "unsupported" ? g.prefill.statement : "" });
              if (g.prefill.value != null) q.set("value", String(g.prefill.value));
              if (g.prefill.unit) q.set("unit", g.prefill.unit);
              return (
                <div key={`${g.kind}${g.fact_code}${g.claim}`} className="flex flex-wrap items-start gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">&ldquo;{g.claim}&rdquo; <span className="font-normal text-muted">· {g.count} time{g.count > 1 ? "s" : ""} in {g.drafts} draft{g.drafts > 1 ? "s" : ""} · {g.channels.map((c) => CHANNEL_LABEL[c as Channel]).join(", ")}</span></p>
                    <p className="text-muted">
                      {g.kind === "unsupported" ? "No approved fact supports this." : <>Keeps disagreeing with <b>{g.fact_code}</b>. If the real figure has changed, update the fact; otherwise brief writers on the approved one.</>}
                      {" "}<span className="inline-flex gap-1">{[...new Set(g.records.map((r) => r.sample))].map((smp) => <Source key={String(smp)} r={g.records.find((r) => r.sample === smp)!} />)}</span>
                    </p>
                  </div>
                  {manager && (g.kind === "unsupported"
                    ? <Link href={`/app/facts?${q}#add-fact`} className={btn.secondary}>Add as a fact</Link>
                    : <Link href="/app/facts" className={btn.secondary}>Review {g.fact_code}</Link>)}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* ── Decisions as test cases ────────────────────────────────── */}
      <section aria-labelledby="cases-h">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="cases-h" className="text-lg font-semibold text-primary-d">Decisions kept as test cases</h2>
            <p className="mb-3 text-sm text-muted">Every human decision is a labelled example for the checker: an accepted fix or an upheld finding means &ldquo;should be flagged&rdquo;, an override means &ldquo;should pass&rdquo;. They are used to test rule and checker changes.</p>
          </div>
          <a href={`/app/insights/cases${view === "mine" ? "?view=mine" : ""}`} className={`${btn.secondary} mb-3`} download>Download test cases (JSON)</a>
        </div>
        {i.testCases.length === 0 ? <Card className="p-4 text-sm text-muted">No decisions yet.</Card> : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Test cases per rule</caption>
              <thead className="text-left text-xs text-muted"><tr><th className="p-2.5">Rule</th><th className="p-2.5">Should be flagged</th><th className="p-2.5">Should pass</th><th className="p-2.5">Examples</th></tr></thead>
              <tbody className="divide-y divide-line">
                {i.testCases.map((t) => (
                  <tr key={t.rule.code}>
                    <td className="p-2.5"><span className="font-mono font-bold text-primary-d">{t.rule.code}</span> <span className="text-muted">{t.rule.title}</span></td>
                    <td className="p-2.5 font-semibold">{t.shouldFlag.length}</td>
                    <td className="p-2.5 font-semibold">{t.shouldPass.length}</td>
                    <td className="p-2.5 text-muted">
                      {[...t.shouldPass.slice(0, 1).map((r) => `pass: “${r.quote.slice(0, 50)}”`), ...t.shouldFlag.slice(0, 1).map((r) => `flag: “${r.quote.slice(0, 50)}”`)].join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}
