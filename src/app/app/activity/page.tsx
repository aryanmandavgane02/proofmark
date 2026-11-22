import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, timeAgo } from "@/components/ui";
import { describeEvent } from "@/lib/events";

export default async function AuditTrail() {
  const s = await requireSession();
  const [{ data: events }, { data: drafts }, { data: approvals }] = await Promise.all([
    s.supabase.from("events").select("id, type, person_id, draft_id, detail, created_at").eq("workspace_id", s.workspace.id).order("created_at", { ascending: false }).limit(200),
    s.supabase.from("drafts").select("id, title").eq("workspace_id", s.workspace.id),
    s.supabase.from("approvals").select("id, draft_id, approver_id, rulebook_version, fingerprint, file_hash, overrides, ai_services, valid, created_at").eq("workspace_id", s.workspace.id).order("created_at", { ascending: false }),
  ]);
  const title = new Map((drafts ?? []).map((d) => [d.id, d.title]));
  const who = new Map(s.people.map((p) => [p.id, p.name]));
  return (
    <>
      <PageTitle title="Audit trail" subtitle="Every action in this workspace, newest first. The trail is append-only: the database refuses edits and deletions, even from inside the app." />
      <h2 className="mb-2 text-sm font-semibold text-primary-d">Approvals</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-d text-left text-white">
            <tr><th className="p-2.5">Draft</th><th className="p-2.5">Approved by</th><th className="p-2.5">When</th><th className="p-2.5">Rulebook</th><th className="p-2.5">Fingerprint</th><th className="p-2.5">Overrides</th><th className="p-2.5">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(approvals ?? []).length === 0 && <tr><td className="p-3 text-muted" colSpan={7}>No approvals yet.</td></tr>}
            {(approvals ?? []).map((a) => (
              <tr key={a.id}>
                <td className="p-2.5"><Link className="text-primary hover:underline" href={`/app/drafts/${a.draft_id}`}>{title.get(a.draft_id) ?? "—"}</Link></td>
                <td className="p-2.5">{who.get(a.approver_id)}</td>
                <td className="p-2.5">{timeAgo(a.created_at)}</td>
                <td className="p-2.5">v{a.rulebook_version}</td>
                <td className="p-2.5 font-mono text-xs">{a.fingerprint.slice(0, 12)}{a.file_hash && <span className="block text-muted" title={`SHA-256 of the approved PDF: ${a.file_hash}`}>PDF {a.file_hash.slice(0, 12)}</span>}</td>
                <td className="p-2.5">{a.overrides.length ? a.overrides.map((o: { rule: string }) => o.rule).join(", ") : "none"}</td>
                <td className="p-2.5">{a.valid ? "Valid" : "Withdrawn: edited after approval"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">All events</h2>
      <Card className="divide-y divide-line">
        {(events ?? []).map((e) => (
          <div key={e.id} className="flex flex-wrap gap-x-3 p-3 text-sm">
            <span className="w-20 flex-none text-xs text-muted">{timeAgo(e.created_at)}</span>
            <span className="min-w-0 flex-1">
              <b>{who.get(e.person_id) ?? "System"}</b> {describeEvent(e.type, e.detail)}
              {e.draft_id && <> · <Link className="text-primary underline underline-offset-2" href={`/app/drafts/${e.draft_id}`}>{title.get(e.draft_id) ?? "draft"}</Link></>}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
