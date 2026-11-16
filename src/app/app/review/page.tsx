import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, StatusPill, timeAgo } from "@/components/ui";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";

export default async function ReviewQueue() {
  const s = await requireSession();
  const { data: drafts } = await s.supabase
    .from("drafts")
    .select("id, title, channel, status, reviewer_id, route_reason, updated_at")
    .eq("workspace_id", s.workspace.id)
    .in("status", ["in_review", "changes_requested", "approved"])
    .order("updated_at", { ascending: false });
  const personBy = new Map(s.people.map((p) => [p.id, p]));
  const mine = (drafts ?? []).filter((d) => d.status === "in_review" && (d.reviewer_id === s.person.id || s.person.role === "manager"));
  const others = (drafts ?? []).filter((d) => !mine.includes(d));
  return (
    <>
      <PageTitle
        title="Review queue"
        subtitle={s.person.role === "creator"
          ? `You are acting as ${s.person.name}, a creator. Creators cannot approve. Switch to Ritu, Kabir or Meera with "Acting as" at the top to review.`
          : `Drafts routed to ${s.person.name}${s.person.role === "manager" ? " (the brand manager sees every draft in review)" : ""}. Proofmark routes claims to legal, visual issues to the design lead and the rest to the brand manager.`}
      />
      <h2 className="mb-2 text-sm font-semibold text-primary-d">Waiting for you</h2>
      <Card className="divide-y divide-line">
        {mine.length === 0 && <p className="p-4 text-sm text-muted">Nothing is waiting for {s.person.name}.</p>}
        {mine.map((d) => (
          <Link key={d.id} href={`/app/drafts/${d.id}`} className="block p-4 hover:bg-soft">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{d.title}</span>
              <span className="text-sm text-muted">{CHANNEL_LABEL[d.channel as Channel]}</span>
              <span className="ml-auto text-xs text-muted">{timeAgo(d.updated_at)}</span>
              <StatusPill status={d.status} />
            </div>
            <p className="mt-1 text-sm text-muted">Assigned to {personBy.get(d.reviewer_id)?.name ?? "—"}: {d.route_reason}</p>
          </Link>
        ))}
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Everything else in review or done</h2>
      <Card className="divide-y divide-line">
        {others.length === 0 && <p className="p-4 text-sm text-muted">Nothing yet.</p>}
        {others.map((d) => (
          <Link key={d.id} href={`/app/drafts/${d.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-soft">
            <span className="font-medium">{d.title}</span>
            <span className="text-sm text-muted">{personBy.get(d.reviewer_id)?.name ? `Reviewer: ${personBy.get(d.reviewer_id)?.name}` : ""}</span>
            <span className="ml-auto text-xs text-muted">{timeAgo(d.updated_at)}</span>
            <StatusPill status={d.status} />
          </Link>
        ))}
      </Card>
    </>
  );
}
