import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import { PrintButton } from "./PrintButton";

// A printable approval record: what was approved, by whom, against which rules, and how every finding was settled.
export default async function ApprovalRecord(props: PageProps<"/app/drafts/[id]/record">) {
  const { id } = await props.params;
  const s = await requireSession();
  const { data: draft } = await s.supabase.from("drafts").select("id, title, channel, status, created_by").eq("id", id).maybeSingle();
  if (!draft) notFound();
  const { data: approvals } = await s.supabase.from("approvals").select("*").eq("draft_id", id).eq("valid", true).order("created_at", { ascending: false }).limit(1);
  const approval = approvals?.[0];
  const who = new Map(s.people.map((p) => [p.id, `${p.name} (${p.title})`]));
  if (!approval) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-primary-d">Approval record</h1>
        <p className="mt-2 text-sm text-muted">&ldquo;{draft.title}&rdquo; has no valid approval right now. <Link href={`/app/drafts/${id}`} className="font-semibold text-primary">Back to the draft</Link></p>
      </div>
    );
  }
  const [{ data: version }, { data: run }, { data: decisions }] = await Promise.all([
    s.supabase.from("draft_versions").select("version, body, alt_text, file_name, file_hash, page_count").eq("id", approval.draft_version_id).single(),
    s.supabase.from("check_runs").select("id, rulebook_version, ai_model, ai_status, created_at").eq("draft_version_id", approval.draft_version_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    s.supabase.from("decisions").select("finding_id, action, reason, person_id, created_at").eq("draft_id", id).order("created_at"),
  ]);
  const { data: findings } = run ? await s.supabase.from("findings").select("id, rule_code, quote, status, severity, label, page").eq("check_run_id", run.id).order("severity") : { data: [] };
  const row = (k: string, v: React.ReactNode) => (<><dt className="text-muted">{k}</dt><dd>{v}</dd></>);
  return (
    <article className="max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.workspace.brand_name} · approval record</p>
          <h1 className="text-2xl font-bold text-primary-d">{draft.title}</h1>
        </div>
        <PrintButton />
      </div>
      <dl className="grid grid-cols-[170px_1fr] gap-x-4 gap-y-1.5 text-sm">
        {row("Channel", CHANNEL_LABEL[draft.channel as Channel])}
        {row("Approved version", `Version ${version?.version}`)}
        {row("Approved by", `${who.get(approval.approver_id) ?? "—"}, ${new Date(approval.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST`)}
        {row("Created by", who.get(draft.created_by) ?? "—")}
        {row("Checked against", `Rulebook v${approval.rulebook_version}`)}
        {row("Content fingerprint", <span className="font-mono">{approval.fingerprint}</span>)}
        {approval.file_hash && row("Approved file", <>{version?.file_name} ({version?.page_count} pages)<br /><span className="break-all font-mono text-xs">SHA-256 {approval.file_hash}</span></>)}
        {row("AI services used", approval.ai_services.length ? approval.ai_services.join(", ") : "none (code checks only)")}
        {row("Overrides", approval.overrides.length ? approval.overrides.map((o: { rule: string; quote: string }) => `${o.rule} “${o.quote}”`).join("; ") : "none")}
      </dl>
      {!approval.file_hash && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-primary-d">Approved text</h2>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border border-line bg-surface p-3 text-sm">{version?.body}</p>
          {version?.alt_text && <p className="mt-1 text-sm"><span className="text-muted">Image alt text:</span> {version.alt_text}</p>}
        </section>
      )}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-primary-d">How each finding was settled ({(findings ?? []).length})</h2>
        {(findings ?? []).length === 0 ? (
          <p className="text-sm text-muted">The approved version had no findings.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1 pr-2">Rule</th><th className="py-1 pr-2">Quote</th><th className="py-1 pr-2">Outcome</th><th className="py-1">Reason given</th></tr></thead>
            <tbody className="divide-y divide-line align-top">
              {(findings ?? []).map((f) => {
                const d = (decisions ?? []).filter((x) => x.finding_id === f.id && x.reason).at(-1);
                return (
                  <tr key={f.id}>
                    <td className="py-1.5 pr-2 font-mono text-xs">{f.rule_code}{f.page ? ` · p.${f.page}` : ""}</td>
                    <td className="py-1.5 pr-2">&ldquo;{f.quote.length > 80 ? `${f.quote.slice(0, 80)}…` : f.quote}&rdquo;</td>
                    <td className="py-1.5 pr-2 capitalize">{f.status}</td>
                    <td className="py-1.5 text-muted">{d ? `${d.reason} (${who.get(d.person_id ?? "")?.split(" (")[0] ?? "—"})` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-muted">Printed from Proofmark. Any later edit creates a new version and withdraws this approval; the audit trail keeps every step.</p>
    </article>
  );
}
