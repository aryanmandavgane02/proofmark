import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { Card, CategoryChip, LabelChip, SeverityChip, StatusPill, btn, input, timeAgo } from "@/components/ui";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import { acceptFix, addComment, approveDraft, confirmIntent, disputeFinding, requestChanges, rerunChecks, resolveDispute, saveEdit, submitForReview } from "@/app/actions";
import { Highlighted, type Mark } from "./Highlighted";
import { PendingButton } from "./PendingButton";

type Finding = {
  id: string; category: string; severity: string; rule_code: string; fact_code: string | null; field: string; quote: string;
  start_at: number | null; end_at: number | null; message: string; fix_kind: string; fix_text: string | null; label: string; status: string;
};

const ORDER = { blocker: 0, major: 1, minor: 2 } as Record<string, number>;
const LIVE = ["open", "disputed", "upheld"];

export default async function DraftPage(props: PageProps<"/app/drafts/[id]">) {
  const { id } = await props.params;
  const s = await requireSession();
  const { data: draft } = await s.supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (!draft) notFound();

  const [{ data: version }, { data: versions }, { data: rules }, { data: facts }, { data: comments }, { data: events }, { data: approvals }, { data: decisions }] = await Promise.all([
    s.supabase.from("draft_versions").select("*").eq("draft_id", id).eq("version", draft.current_version).single(),
    s.supabase.from("draft_versions").select("version, change_note, created_at, created_by").eq("draft_id", id).order("version", { ascending: false }),
    s.supabase.from("rules").select("code, title, statement, source_doc, source_page, source_quote, builtin").eq("workspace_id", s.workspace.id),
    s.supabase.from("facts").select("code, statement, source, owner, status").eq("workspace_id", s.workspace.id),
    s.supabase.from("comments").select("id, body, person_id, created_at").eq("draft_id", id).order("created_at"),
    s.supabase.from("events").select("id, type, person_id, detail, created_at").eq("draft_id", id).order("created_at"),
    s.supabase.from("approvals").select("*").eq("draft_id", id).order("created_at", { ascending: false }),
    s.supabase.from("decisions").select("finding_id, action, reason, person_id, created_at").eq("draft_id", id),
  ]);
  const { data: run } = await s.supabase.from("check_runs").select("*").eq("draft_version_id", version!.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: rawFindings } = run ? await s.supabase.from("findings").select("*").eq("check_run_id", run.id) : { data: [] };
  const findings = ((rawFindings ?? []) as Finding[]).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.start_at ?? 9e9) - (b.start_at ?? 9e9));

  const ruleBy = new Map((rules ?? []).map((r) => [r.code, r]));
  const factBy = new Map((facts ?? []).map((f) => [f.code, f]));
  const personBy = new Map(s.people.map((p) => [p.id, p]));
  const decisionFor = (fid: string, action: string) => (decisions ?? []).filter((d) => d.finding_id === fid && d.action === action).at(-1);

  const live = findings.filter((f) => LIVE.includes(f.status));
  const openBlockers = live.filter((f) => f.severity === "blocker" && (f.status === "open" || f.status === "upheld"));
  const disputed = live.filter((f) => f.status === "disputed");
  const upheld = live.filter((f) => f.status === "upheld");
  const canReview = s.person.role !== "creator";
  const reviewer = draft.reviewer_id ? personBy.get(draft.reviewer_id) : null;
  const approval = (approvals ?? []).find((a) => a.valid);
  const marks: Mark[] = live
    .filter((f) => f.field === "body" && f.start_at != null && f.end_at != null)
    .map((f) => ({ id: f.id, start: f.start_at!, end: f.end_at!, severity: f.severity }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app" className="text-sm text-muted hover:underline">← Start here</Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-d">{draft.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {CHANNEL_LABEL[draft.channel as Channel]} · version {draft.current_version} · checked against rulebook v{run?.rulebook_version ?? s.workspace.rulebook_version}
            {run && <> · {run.ms} ms</>}
          </p>
        </div>
        <StatusPill status={draft.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left: content */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Content</h2>
            <Highlighted text={version!.body} marks={marks} />
            {(draft.channel === "instagram" || draft.channel === "ad" || version!.alt_text) && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Image alt text</h3>
                <p className={`mt-1 text-sm ${version!.alt_text ? "text-ink" : "italic text-muted"}`}>{version!.alt_text || "(none)"}</p>
              </div>
            )}
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Edit the text yourself</summary>
              <form action={saveEdit} className="mt-3 space-y-3">
                <input type="hidden" name="draft_id" value={id} />
                <textarea name="body" defaultValue={version!.body} rows={8} maxLength={5000} className={`${input} font-mono text-[13px]`} aria-label="Content" />
                <input name="alt_text" defaultValue={version!.alt_text} maxLength={400} className={input} aria-label="Image alt text" placeholder="Image alt text" />
                <PendingButton className={btn.secondary} pendingText="Saving and re-checking…">Save as a new version and re-check</PendingButton>
              </form>
            </details>
          </Card>

          {/* Workflow */}
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Review and approval</h2>
            {(draft.status === "draft" || draft.status === "changes_requested") && (
              <form action={submitForReview} className="space-y-2">
                <input type="hidden" name="draft_id" value={id} />
                {openBlockers.length > 0 ? (
                  <p className="text-sm text-red">
                    {openBlockers.length} blocker{openBlockers.length > 1 ? "s" : ""} must be fixed or disputed before review: {openBlockers.map((f) => f.rule_code).join(", ")}.
                  </p>
                ) : (
                  <p className="text-sm text-muted">{live.length ? `${live.length} finding${live.length > 1 ? "s" : ""} still open or disputed. The reviewer will see them.` : "No open findings."} Proofmark picks the reviewer from the kind of findings left.</p>
                )}
                <PendingButton className={btn.primary} disabled={openBlockers.length > 0} pendingText="Submitting…">Submit for review</PendingButton>
              </form>
            )}
            {draft.status === "in_review" && (
              <div className="space-y-3">
                <p className="text-sm">
                  Assigned to <b>{reviewer?.name ?? "the brand manager"}</b>{reviewer ? ` (${reviewer.title})` : ""}. <span className="text-muted">{draft.route_reason}</span>
                </p>
                {canReview ? (
                  <>
                    {(disputed.length > 0 || upheld.length > 0 || openBlockers.length > 0) && (
                      <p className="text-sm text-[#7a3d00]">
                        Before approving: {disputed.length > 0 && <>resolve {disputed.length} disputed finding{disputed.length > 1 ? "s" : ""}. </>}
                        {(upheld.length > 0 || openBlockers.length > 0) && <>Upheld or blocking findings must be fixed by the creator first.</>}
                      </p>
                    )}
                    <form action={approveDraft}>
                      <input type="hidden" name="draft_id" value={id} />
                      <PendingButton className={btn.accent} disabled={disputed.length + upheld.length + openBlockers.length > 0} pendingText="Approving…">Approve this version</PendingButton>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-primary">Request changes</summary>
                      <form action={requestChanges} className="mt-2 space-y-2">
                        <input type="hidden" name="draft_id" value={id} />
                        <textarea name="note" required minLength={3} rows={2} className={input} placeholder="What should the creator change?" />
                        <PendingButton className={btn.secondary} pendingText="Sending…">Send back to the creator</PendingButton>
                      </form>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-muted">Waiting for the reviewer. Switch to {reviewer?.name ?? "Meera"} with &ldquo;Acting as&rdquo; at the top to review it.</p>
                )}
              </div>
            )}
            {draft.status === "approved" && approval && (
              <div className="rounded-lg bg-[#d8f0ea] p-3 text-sm text-[#0a5c4f]">
                <p className="font-semibold">Approved by {personBy.get(approval.approver_id)?.name} · {timeAgo(approval.created_at)}</p>
                <dl className="mt-2 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt>Version</dt><dd>{draft.current_version}</dd>
                  <dt>Content fingerprint</dt><dd className="font-mono">{approval.fingerprint.slice(0, 16)}</dd>
                  <dt>Rulebook</dt><dd>v{approval.rulebook_version}</dd>
                  <dt>Overrides</dt><dd>{approval.overrides.length ? approval.overrides.map((o: { rule: string }) => o.rule).join(", ") : "none"}</dd>
                  <dt>AI services used</dt><dd>{approval.ai_services.length ? approval.ai_services.join(", ") : "none (code checks only)"}</dd>
                </dl>
                <p className="mt-2 text-xs">Any later edit creates a new version and needs a new approval.</p>
              </div>
            )}
          </Card>

          {/* Activity */}
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Activity</h2>
            <ol className="space-y-2 text-sm">
              {[...(events ?? []).map((e) => ({ k: `e${e.id}`, at: e.created_at, who: personBy.get(e.person_id)?.name, text: describeEvent(e.type, e.detail) })),
                ...(comments ?? []).map((c) => ({ k: `c${c.id}`, at: c.created_at, who: personBy.get(c.person_id)?.name, text: `“${c.body}”` }))]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((x) => (
                  <li key={x.k} className="flex gap-2"><span className="w-16 flex-none text-xs text-muted">{timeAgo(x.at)}</span><span><b>{x.who ?? "System"}</b> {x.text}</span></li>
                ))}
            </ol>
            <form action={addComment} className="mt-3 flex gap-2">
              <input type="hidden" name="draft_id" value={id} />
              <input name="body" required maxLength={2000} className={input} placeholder="Add a comment" aria-label="Comment" />
              <button className={btn.secondary}>Post</button>
            </form>
            <p className="mt-3 text-xs text-muted">Versions: {(versions ?? []).map((v) => `v${v.version}${v.change_note ? ` (${v.change_note})` : ""}`).join(" · ")}</p>
          </Card>
        </div>

        {/* Right: findings */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-primary-d">{live.length ? `${live.length} finding${live.length > 1 ? "s" : ""}` : "No open findings"}</h2>
            <span className="text-xs text-muted">{run?.ai_status === "off" ? "Code checks only (AI off)" : run?.ai_status === "unavailable" ? "Code checks only (AI unavailable)" : run?.ai_model ? "Code checks + AI" : "Code checks"}</span>
          </div>
          {run?.ai_status === "unavailable" && (
            <div role="status" className="rounded-xl border border-amber/40 bg-[#fff6e5] p-4 text-sm text-[#7a3d00]">
              <p className="font-semibold">AI checks did not run this time</p>
              <p className="mt-1">{run.ai_error ?? "The AI service was unavailable."} Every code check below still ran, so claims, facts, terms and accessibility are covered.</p>
              <form action={rerunChecks} className="mt-2">
                <input type="hidden" name="draft_id" value={id} />
                <PendingButton className={btn.secondary} pendingText="Checking again…">Run the checks again</PendingButton>
              </form>
            </div>
          )}
          {version!.intent && (
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">What this draft is for</h3>
                <span className={`text-xs font-semibold ${version!.intent_confirmed ? "text-accent" : "text-[#7a3d00]"}`}>{version!.intent_confirmed ? "Confirmed by the creator" : "Suggested by AI, please confirm"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Goal</dt><dd>{version!.intent.goal}</dd>
                <dt className="text-muted">Audience</dt><dd>{version!.intent.audience}</dd>
                <dt className="text-muted">Call to action</dt><dd>{version!.intent.call_to_action}</dd>
              </dl>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-primary">{version!.intent_confirmed ? "Edit" : "Confirm or correct it"}</summary>
                <form action={confirmIntent} className="mt-2 grid gap-2">
                  <input type="hidden" name="draft_id" value={id} />
                  <input name="goal" defaultValue={version!.intent.goal} className={input} aria-label="Goal" maxLength={200} />
                  <input name="audience" defaultValue={version!.intent.audience} className={input} aria-label="Audience" maxLength={200} />
                  <input name="call_to_action" defaultValue={version!.intent.call_to_action} className={input} aria-label="Call to action" maxLength={200} />
                  <PendingButton className={btn.secondary} pendingText="Saving…">This is right</PendingButton>
                </form>
              </details>
              <p className="mt-2 text-xs text-muted">Suggested fixes are written to keep this purpose.</p>
            </Card>
          )}
          {findings.length === 0 && (
            <Card className="p-5 text-sm text-muted">Nothing breaks the approved rules, facts or terms. It can go to review as it is.</Card>
          )}
          {findings.map((f) => {
            const rule = ruleBy.get(f.rule_code);
            const fact = f.fact_code ? factBy.get(f.fact_code) : null;
            const dispute = decisionFor(f.id, "dispute");
            const resolved = decisionFor(f.id, f.status === "overridden" ? "override" : "uphold");
            const closed = !LIVE.includes(f.status);
            return (
              <Card key={f.id} className={`p-4 ${closed ? "opacity-70" : ""}`}>
                <div id={`f-${f.id}`} className="scroll-mt-24">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityChip severity={f.severity} />
                    <CategoryChip category={f.category} />
                    <LabelChip label={f.label} />
                    {f.status !== "open" && <span className="ml-auto text-xs font-semibold uppercase text-muted">{f.status}</span>}
                  </div>
                  <p className="mt-2 font-semibold text-ink">&ldquo;{f.quote}&rdquo;</p>
                  <p className="mt-1 text-sm text-ink"><b>Why:</b> {f.message}</p>
                  {rule && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary"><b>{rule.code}</b> · {rule.title} · {rule.builtin ? rule.source_doc : `${rule.source_doc}, p. ${rule.source_page}`}</summary>
                      <blockquote className="mt-1 border-l-2 border-line pl-3 text-muted">&ldquo;{rule.source_quote}&rdquo;</blockquote>
                    </details>
                  )}
                  {fact && <p className="mt-1 text-sm text-muted">Fact <b>{f.fact_code}</b>: {fact.statement} <span className="text-xs">({fact.source}; owner {fact.owner}{fact.status !== "approved" ? `; ${fact.status}` : ""})</span></p>}
                  {f.fix_text && (
                    <div className="mt-2 rounded-lg bg-[#eef7f4] p-2.5 text-sm">
                      <span className="font-semibold text-[#0a5c4f]">Suggested {f.fix_kind === "none" ? "correction" : "fix"}:</span>{" "}
                      {f.fix_kind === "none" ? f.fix_text : <span className="font-medium">&ldquo;{f.fix_text.trim()}&rdquo;</span>}
                    </div>
                  )}
                  {dispute && <p className="mt-2 text-sm"><b>Disputed by {personBy.get(dispute.person_id)?.name}:</b> {dispute.reason}</p>}
                  {resolved && <p className="mt-1 text-sm"><b>{f.status === "overridden" ? "Overridden" : "Upheld"} by {personBy.get(resolved.person_id)?.name}:</b> {resolved.reason}</p>}

                  {(f.status === "open" || f.status === "upheld") && (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      {f.fix_kind !== "none" && (
                        <form action={acceptFix}>
                          <input type="hidden" name="finding_id" value={f.id} />
                          <PendingButton className={`${btn.small} bg-accent text-white hover:brightness-110`} pendingText="Applying…">Accept fix</PendingButton>
                        </form>
                      )}
                      {f.status === "open" && (
                        <details className="text-sm">
                          <summary className={`${btn.small} cursor-pointer list-none border border-line text-primary-d hover:bg-soft`}>Dispute</summary>
                          <form action={disputeFinding} className="mt-2 flex flex-col gap-2 sm:w-96">
                            <input type="hidden" name="finding_id" value={f.id} />
                            <textarea name="reason" required minLength={3} rows={2} className={input} placeholder="Why does this not apply here?" />
                            <PendingButton className={btn.secondary} pendingText="Sending…">Send dispute to the reviewer</PendingButton>
                          </form>
                        </details>
                      )}
                    </div>
                  )}
                  {f.status === "disputed" && canReview && (
                    <form action={resolveDispute} className="mt-3 space-y-2 rounded-lg border border-line p-3">
                      <input type="hidden" name="finding_id" value={f.id} />
                      <p className="text-sm font-semibold">Your decision as {s.person.name}</p>
                      <textarea name="reason" required minLength={3} rows={2} className={input} placeholder="Reason (saved with the decision)" />
                      <div className="flex gap-2">
                        <button name="decision" value="override" className={btn.secondary}>Override: it is fine here</button>
                        <button name="decision" value="uphold" className={btn.danger}>Uphold: it must be fixed</button>
                      </div>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
          {run && (
            <details className="rounded-xl border border-line bg-surface p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-primary-d">How this was checked</summary>
              <dl className="mt-3 grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-muted">Rulebook</dt><dd>v{run.rulebook_version}</dd>
                <dt className="text-muted">Code checks</dt><dd>{findings.filter((f) => f.label === "code").length} finding(s), {run.ms - (run.ai_ms ?? 0)} ms, no AI involved</dd>
                <dt className="text-muted">AI checks</dt>
                <dd>
                  {run.ai_status === "off" && "Off: this workspace runs code checks only, so nothing was sent to an AI service."}
                  {run.ai_status === "unavailable" && `Did not run: ${run.ai_error ?? "service unavailable"}`}
                  {(run.ai_status === "ok" || run.ai_status === "cached") && <>{run.ai_model} · {run.ai_requests} request{run.ai_requests === 1 ? "" : "s"}{run.ai_status === "cached" ? " (stored result reused for identical content)" : ""} · {run.ai_ms} ms</>}
                </dd>
                <dt className="text-muted">Proof check</dt>
                <dd>
                  {(run.ai_status === "ok" || run.ai_status === "cached") ? (
                    <>
                      {findings.filter((f) => f.label !== "code").length} AI finding(s) passed: quote found in the draft, rule approved and applicable.
                      {run.dropped.length > 0 ? <> {run.dropped.length} dropped:</> : " None dropped."}
                      {run.dropped.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-muted">
                          {run.dropped.map((d: { rule_code: string; quote: string; reason: string }, i: number) => <li key={i}><b>{d.rule_code}</b> &ldquo;{d.quote}&rdquo;: {d.reason}</li>)}
                        </ul>
                      )}
                    </>
                  ) : "Not needed: no AI findings."}
                </dd>
                <dt className="text-muted">Second opinion</dt><dd>Tone and messaging findings are checked again independently. If the two disagree, the finding is labelled &ldquo;needs human judgment&rdquo;.</dd>
              </dl>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function describeEvent(type: string, detail: Record<string, unknown>): string {
  switch (type) {
    case "draft.created": return "created the draft and ran the checks.";
    case "version.created": return `saved version ${detail.version}: ${detail.note}.`;
    case "finding.disputed": return `disputed ${detail.rule}.`;
    case "finding.overridden": return `overrode ${detail.rule}.`;
    case "finding.upheld": return `upheld ${detail.rule}.`;
    case "draft.submitted": return `submitted it for review. Routed to ${detail.reviewer}: ${detail.reason}`;
    case "draft.approved": return `approved version ${detail.version}.`;
    case "draft.changes_requested": return "requested changes.";
    case "approval.invalidated": return "edited it after approval, so it needs a new approval.";
    default: return type;
  }
}
