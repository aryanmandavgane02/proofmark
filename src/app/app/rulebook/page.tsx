import Link from "next/link";
import { settingLabel } from "@/lib/rule-settings";
import { requireSession } from "@/lib/session";
import { Card, CategoryChip, PageTitle, SeverityChip, btn, input, timeAgo } from "@/components/ui";
import { CATEGORIES, CHANNELS, CHANNEL_LABEL } from "@/lib/checks/types";
import { approveAllVerified, publishRulebook, reviewRule } from "@/app/brand-actions";
import { PendingButton } from "../drafts/[id]/PendingButton";
import { pendingChanges as diffRules } from "@/lib/rulebook";
import { previewReplay } from "@/app/insight-actions";
import { ReplaySummary, ReplayTable } from "../ReplayTable";
import type { StoredReplay } from "@/lib/replay-server";

// Publishing and importing run here; importing reads a PDF and asks the AI once.
export const maxDuration = 60;

const KIND: Record<string, string> = { code: "Checked by code", ai: "Checked by AI", both: "Code + AI" };
type RuleRow = {
  code: string; category: string; title: string; statement: string; severity: string; channels: string[]; check_kind: string;
  source_doc: string; source_page: number | null; source_quote: string; builtin: boolean; status: string; import_id: string | null; params?: unknown;
  check_type?: string | null;
};

/** The check settings of a code rule, each in a field of its own type. Applied when the rulebook is published. */
function Settings({ r }: { r: RuleRow }) {
  const params = (r.params && typeof r.params === "object" ? r.params : {}) as Record<string, unknown>;
  const entries = Object.entries(params);
  if (r.check_kind === "ai" || !entries.length) return null;
  return (
    <fieldset className="grid gap-2 rounded-lg border border-line bg-surface p-2.5 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold text-muted">Check settings (used by the code check once published)</legend>
      {entries.map(([k, v]) => {
        const label = settingLabel(r.check_type ?? null, k);
        if (typeof v === "number") return <label key={k} className="text-xs font-semibold text-muted">{label}<input type="number" step="any" min={0} name={`param.${k}`} defaultValue={v} className={input} /></label>;
        if (typeof v === "string") return <label key={k} className="text-xs font-semibold text-muted">{label}<input name={`param.${k}`} defaultValue={v} maxLength={80} className={input} /></label>;
        if (Array.isArray(v)) return <label key={k} className="text-xs font-semibold text-muted sm:col-span-2">{label}<textarea name={`param.${k}`} defaultValue={v.join("\n")} rows={Math.min(6, Math.max(2, v.length))} className={input} /></label>;
        if (v && typeof v === "object") return (
          <div key={k} className="sm:col-span-2">
            <p className="text-xs font-semibold text-muted">{label}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(v as Record<string, number>).map(([sub, n]) => (
                <label key={sub} className="text-xs text-muted">{CHANNEL_LABEL[sub as keyof typeof CHANNEL_LABEL] ?? sub}<input type="number" step="any" min={0} name={`param.${k}.${sub}`} defaultValue={n} className={`${input} w-24`} /></label>
              ))}
            </div>
          </div>
        );
        return null;
      })}
    </fieldset>
  );
}

function RuleForm({ r, primary }: { r: RuleRow; primary: "approve" | "save" }) {
  return (
    <form action={reviewRule} className="mt-3 grid gap-2 rounded-lg border border-line bg-soft p-3">
      <input type="hidden" name="code" value={r.code} />
      <label className="text-xs font-semibold text-muted">Title<input name="title" defaultValue={r.title} maxLength={80} className={input} /></label>
      <label className="text-xs font-semibold text-muted">Rule (what the checker enforces)<textarea name="statement" defaultValue={r.statement} rows={2} maxLength={400} className={input} /></label>
      <Settings r={r} />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="font-semibold text-muted">Severity{" "}
          <select name="severity" defaultValue={r.severity} className="rounded border border-line bg-surface px-1.5 py-1"><option value="blocker">Blocker</option><option value="major">Major</option><option value="minor">Minor</option></select>
        </label>
        <span className="font-semibold text-muted">Channels (tick at least one):</span>
        {CHANNELS.map((c) => (
          <label key={c} className="flex items-center gap-1"><input type="checkbox" name="channels" value={c} defaultChecked={r.channels.length === 0 || r.channels.includes(c)} />{CHANNEL_LABEL[c]}</label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {primary === "approve" ? (
          <>
            <button name="decision" value="approve" className={btn.accent}>Approve</button>
            <button name="decision" value="save" className={btn.secondary}>Save edits</button>
            <button name="decision" value="reject" className={btn.danger}>Reject</button>
          </>
        ) : (
          <>
            <button name="decision" value="save" className={btn.secondary}>Save changes</button>
            <button name="decision" value="reject" className={btn.danger}>Retire this rule</button>
          </>
        )}
      </div>
    </form>
  );
}

export default async function Rulebook(props: PageProps<"/app/rulebook">) {
  const sp = await props.searchParams;
  const s = await requireSession();
  const manager = s.person.role === "manager";
  const [{ data: rulesRaw }, { data: versions }, importRes, { data: replayRows }] = await Promise.all([
    s.supabase.from("rules").select("code, category, title, statement, severity, channels, params, check_kind, check_type, source_doc, source_page, source_quote, builtin, status, import_id").eq("workspace_id", s.workspace.id).order("code"),
    s.supabase.from("rulebook_versions").select("version, note, published_at, published_by, snapshot").eq("workspace_id", s.workspace.id).order("version", { ascending: false }),
    sp.import ? s.supabase.from("imports").select("*").eq("id", String(sp.import)).maybeSingle() : Promise.resolve({ data: null }),
    s.supabase.from("rule_replays").select("*").eq("workspace_id", s.workspace.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const replays = (replayRows ?? []) as StoredReplay[];
  const norm = (t: string) => t.trim().replace(/\s+/g, " ");
  const rules = (rulesRaw ?? []) as RuleRow[];
  const latest = versions?.[0];
  const live = new Map(((latest?.snapshot ?? []) as RuleRow[]).map((r) => [r.code, r]));
  const by = new Map(s.people.map((p) => [p.id, p.name]));
  const imp = importRes.data as null | { id: string; file_name: string; pages: number; drafted: number; dropped: { rule_code: string; quote: string; reason: string }[]; ai_model: string; created_at: string };

  // What would change if the manager published now
  const approved = rules.filter((r) => r.status === "approved");
  const { added, changed, removed } = diffRules(approved, [...live.values()]);
  const pendingChanges = added.length + changed.length + removed.length;
  const drafts = rules.filter((r) => r.status === "draft");
  // Edited rules whose wording changed: AI-checked ones are replayed against their past decisions before publishing.
  const reworded = approved.filter((r) => changed.includes(r.code) && live.get(r.code) && norm(live.get(r.code)!.statement) !== norm(r.statement));
  const fromImport = imp ? drafts.filter((r) => r.import_id === imp.id) : [];

  return (
    <>
      <PageTitle
        title={`Rulebook v${latest?.version ?? 1}`}
        subtitle={<>Small, numbered rules approved by the brand manager, each with the exact quote and page it came from. Checks always use the latest published version. {latest && <>v{latest.version} was published by {by.get(latest.published_by) ?? "—"} {timeAgo(latest.published_at)}: {latest.note}.</>}</>}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/samples/urja-brand-guide.pdf" target="_blank" className={btn.secondary}>Open the brand guide (PDF)</a>
            {manager && <Link href="/app/rulebook/import" className={btn.primary}>Import rules from a PDF</Link>}
          </div>
        }
      />
      {!manager && <p className="mb-4 rounded-lg bg-soft p-3 text-sm text-muted">Only the brand manager edits the rulebook. Switch to <b>Meera</b> with &ldquo;Acting as&rdquo; to import, approve or publish rules.</p>}

      {imp && (
        <Card className="mb-6 p-5">
          <h2 className="font-semibold text-primary-d">Imported from {imp.file_name}</h2>
          <p className="mt-1 text-sm text-muted">{imp.pages} page{imp.pages > 1 ? "s" : ""} read. The AI ({imp.ai_model}) drafted rules; code then checked that every quote is really in the document, corrected page numbers and removed duplicates of existing rules.</p>
          <p className="mt-2 text-sm"><b>{imp.drafted}</b> rule{imp.drafted === 1 ? "" : "s"} verified{fromImport.length === imp.drafted ? " and waiting for approval below" : fromImport.length ? `; ${fromImport.length} still waiting for approval below` : "; all of them have been reviewed"}. <b>{imp.dropped.length}</b> not imported{imp.dropped.length ? ":" : "."}</p>
          {imp.dropped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">{imp.dropped.map((d, i) => <li key={i}><b>{d.rule_code}</b>{d.quote ? <> &ldquo;{d.quote.slice(0, 90)}&rdquo;</> : null}: {d.reason}</li>)}</ul>
          )}
          {manager && fromImport.length > 0 && (
            <form action={approveAllVerified} className="mt-3">
              <input type="hidden" name="import_id" value={imp.id} />
              <PendingButton className={btn.accent} pendingText="Approving…">{`Approve all ${fromImport.length} verified rules`}</PendingButton>
            </form>
          )}
        </Card>
      )}

      {manager && pendingChanges > 0 && (
        <div id="pending" className="scroll-mt-4 sm:scroll-mt-44"><Card className="mb-6 border-amber/50 bg-[#fff6e5] p-5">
          <h2 className="font-semibold text-[#7a3d00]">{pendingChanges} change{pendingChanges > 1 ? "s" : ""} not live yet</h2>
          <p className="mt-1 text-sm text-[#7a3d00]">
            {added.length > 0 && <>New: {added.join(", ")}. </>}{changed.length > 0 && <>Edited: {changed.join(", ")}. </>}{removed.length > 0 && <>Retired: {removed.join(", ")}. </>}
            Drafts keep being checked against v{latest?.version ?? 1} until you publish.
          </p>
          {reworded.map((r) => {
            const replay = replays.find((x) => x.rule_code === r.code && x.old_statement === norm(live.get(r.code)!.statement) && x.new_statement === norm(r.statement));
            return (
              <div key={r.code} id={`replay-${r.code}`} className="mt-3 scroll-mt-4 sm:scroll-mt-44 rounded-lg border border-amber/40 bg-surface p-3">
                <p className="text-sm"><b className="font-mono">{r.code}</b> new wording: &ldquo;{r.statement}&rdquo;</p>
                {r.check_kind === "code" ? (
                  <p className="mt-1 text-xs text-muted">Not replayed: {r.code} is checked only by code, so its wording does not change what is flagged.</p>
                ) : replay ? (
                  <div className="mt-2"><ReplayTable replay={replay} /></div>
                ) : (
                  <form action={previewReplay} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="rule_code" value={r.code} /><input type="hidden" name="statement" value={r.statement} /><input type="hidden" name="from" value="rulebook" />
                    <PendingButton className={btn.secondary} pendingText="Replaying…">Preview the effect on past decisions</PendingButton>
                    <span className="text-xs text-muted">Publishing also replays it first if you skip this.</span>
                  </form>
                )}
              </div>
            );
          })}
          <form action={publishRulebook} className="mt-3 flex flex-wrap gap-2">
            <input name="note" maxLength={200} className={`${input} max-w-md`} placeholder="What changed, e.g. Added the November 2026 update" aria-label="What changed" />
            <PendingButton className={btn.primary} pendingText="Publishing…">{`Publish as v${(latest?.version ?? 1) + 1}`}</PendingButton>
          </form>
        </Card></div>
      )}

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-primary-d">Waiting for approval ({drafts.length})</h2>
          <div className="space-y-3">
            {drafts.map((r) => (
              <Card key={r.code} className="p-4">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold text-primary-d">{r.code}</span><CategoryChip category={r.category} /><SeverityChip severity={r.severity} /><span className="text-xs font-semibold uppercase text-[#7a3d00]">Draft from {r.source_doc}</span></div>
                <p className="mt-2 font-semibold">{r.title}</p>
                <p className="text-sm">{r.statement}</p>
                <blockquote className="mt-1 border-l-2 border-accent pl-3 text-sm text-muted">&ldquo;{r.source_quote}&rdquo; <span className="text-xs">— {r.source_doc}, p. {r.source_page} <span className="text-accent">(quote verified in the document)</span></span></blockquote>
                {manager && <RuleForm r={r} primary="approve" />}
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const list = approved.filter((r) => r.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-d"><CategoryChip category={cat} /> {list.length} rule{list.length > 1 ? "s" : ""}</h2>
              <Card className="divide-y divide-line">
                {list.map((r) => (
                  <div key={r.code} className="grid gap-2 p-4 sm:grid-cols-[110px_1fr_190px]">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary-d">{r.code}</p>
                      <SeverityChip severity={r.severity} />
                      {!live.has(r.code) && <p className="mt-1 text-xs font-semibold text-[#7a3d00]">Not live yet</p>}
                    </div>
                    <div>
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-sm text-ink">{r.statement}</p>
                      <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm text-muted">&ldquo;{r.source_quote}&rdquo; <span className="text-xs">— {r.builtin ? r.source_doc : `${r.source_doc}, p. ${r.source_page}`}</span></blockquote>
                      {manager && (
                        <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-primary">Edit</summary><RuleForm r={r} primary="save" /></details>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      <p>{KIND[r.check_kind]}</p>
                      <p>{r.channels.length ? `Channels: ${r.channels.map((c) => CHANNEL_LABEL[c as keyof typeof CHANNEL_LABEL] ?? c).join(", ")}` : "All channels"}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Published versions</h2>
      <Card className="divide-y divide-line">
        {(versions ?? []).map((v) => {
          const kept = replays.filter((x) => x.published_version === v.version);
          return (
            <div key={v.version} className="p-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <b>v{v.version}</b><span className="flex-1">{v.note}</span><span className="text-muted">{(v.snapshot as unknown[]).length} rules · {by.get(v.published_by) ?? "—"} · {timeAgo(v.published_at)}</span>
              </div>
              {kept.map((x) => (
                <details key={x.id} className="mt-2 rounded-lg bg-soft p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">Replay of {x.rule_code} kept with v{v.version}</summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted">Was: &ldquo;{x.old_statement}&rdquo;</p>
                    <p className="text-xs">Now: &ldquo;{x.new_statement}&rdquo;</p>
                    <ReplayTable replay={x} />
                  </div>
                </details>
              ))}
              {kept.length > 0 && <div className="mt-1 text-xs text-muted">{kept.map((x) => <ReplaySummary key={x.id} replay={x} />)}</div>}
            </div>
          );
        })}
      </Card>
    </>
  );
}
