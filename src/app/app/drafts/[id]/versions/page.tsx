import Link from "next/link";
import { notFound } from "next/navigation";
import { diffArrays } from "diff";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, timeAgo } from "@/components/ui";

function Diff({ a, b }: { a: string; b: string }) {
  // Compare whole words (split on spaces) so a changed number reads "50,000+ → 35,000+", not digit by digit.
  const parts = diffArrays(a.split(/(\s+)/), b.split(/(\s+)/)).map((p) => ({ ...p, value: p.value.join("") }));
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-7">
      {parts.map((p, i) =>
        p.added ? <ins key={i} className="rounded-sm bg-[#d8f0ea] text-[#0a5c4f] no-underline">{p.value}</ins>
        : p.removed ? <del key={i} className="rounded-sm bg-[#fde0dd] text-red">{p.value}</del>
        : <span key={i}>{p.value}</span>,
      )}
    </p>
  );
}

export default async function Versions(props: PageProps<"/app/drafts/[id]/versions">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const s = await requireSession();
  const { data: draft } = await s.supabase.from("drafts").select("id, title, current_version").eq("id", id).maybeSingle();
  if (!draft) notFound();
  const [{ data: versions }, { data: runs }, { data: approvals }] = await Promise.all([
    s.supabase.from("draft_versions").select("id, version, body, alt_text, change_note, created_by, created_at, fingerprint").eq("draft_id", id).order("version"),
    s.supabase.from("check_runs").select("id, draft_version_id, created_at, ai_status").eq("workspace_id", s.workspace.id),
    s.supabase.from("approvals").select("draft_version_id, approver_id, valid, created_at").eq("draft_id", id),
  ]);
  const list = versions ?? [];
  const to = Math.min(Number(sp.to ?? draft.current_version) || draft.current_version, draft.current_version);
  const from = Math.max(1, Math.min(Number(sp.from ?? to - 1) || 1, to));
  const A = list.find((v) => v.version === from)!;
  const B = list.find((v) => v.version === to)!;
  const personBy = new Map(s.people.map((p) => [p.id, p.name]));
  const runIds = new Map<string, string>();
  for (const r of (runs ?? []).sort((x, y) => x.created_at.localeCompare(y.created_at))) runIds.set(r.draft_version_id, r.id);
  const { data: counts } = await s.supabase.from("findings").select("check_run_id, status").in("check_run_id", [...runIds.values()]);
  const open = (vid: string) => (counts ?? []).filter((c) => c.check_run_id === runIds.get(vid) && ["open", "disputed", "upheld"].includes(c.status)).length;

  return (
    <>
      <Link href={`/app/drafts/${id}`} className="text-sm text-muted hover:underline">← Back to the draft</Link>
      <PageTitle title={`Versions of “${draft.title}”`} subtitle="Every change is a new version, checked again. Approvals belong to one exact version." />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="divide-y divide-line">
          {[...list].reverse().map((v) => {
            const appr = (approvals ?? []).find((x) => x.draft_version_id === v.id);
            return (
              <div key={v.id} className={`p-3 text-sm ${v.version === to ? "bg-soft" : ""}`}>
                <div className="flex items-center justify-between">
                  <b>Version {v.version}</b>
                  <span className="text-xs text-muted">{timeAgo(v.created_at)}</span>
                </div>
                <p className="text-muted">{v.change_note ?? "First version"} · by {personBy.get(v.created_by) ?? "—"}</p>
                <p className="text-xs">{open(v.id)} open finding(s){appr ? ` · ${appr.valid ? "approved" : "approval withdrawn after edit"} by ${personBy.get(appr.approver_id)}` : ""}</p>
                {v.version > 1 && <Link className="text-xs font-semibold text-primary hover:underline" href={`?from=${v.version - 1}&to=${v.version}`}>Compare with version {v.version - 1}</Link>}
              </div>
            );
          })}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-primary-d">
            {from === to ? `Version ${to}` : <>Changes from version {from} to version {to}</>}
          </h2>
          <p className="mb-3 text-xs text-muted"><ins className="bg-[#d8f0ea] no-underline">Added</ins> · <del className="bg-[#fde0dd]">removed</del></p>
          <Diff a={A.body} b={B.body} />
          {(A.alt_text || B.alt_text) && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Image alt text</h3>
              <Diff a={A.alt_text} b={B.alt_text} />
            </div>
          )}
          <p className="mt-4 font-mono text-xs text-muted">Fingerprints: v{from} {A.fingerprint.slice(0, 12)} → v{to} {B.fingerprint.slice(0, 12)}</p>
        </Card>
      </div>
    </>
  );
}
