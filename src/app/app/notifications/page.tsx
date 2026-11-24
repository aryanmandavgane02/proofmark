import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, timeAgo } from "@/components/ui";
import { markNotificationsRead } from "@/app/actions";
import { PendingButton } from "../drafts/[id]/PendingButton";

export default async function Notifications() {
  const s = await requireSession();
  const { data: notes } = await s.supabase.from("notifications").select("id, text, link, created_at, read_at")
    .eq("workspace_id", s.workspace.id).eq("person_id", s.person.id).order("created_at", { ascending: false }).limit(50);
  const unread = (notes ?? []).filter((n) => !n.read_at).length;
  return (
    <>
      <PageTitle
        title="Notifications"
        subtitle={<>For <b>{s.person.name}</b>, {s.person.title}: for example when a fact changes or ends and one of your approved drafts relied on it. Switch person with &ldquo;Acting as&rdquo; to see someone else&apos;s.</>}
        action={unread > 0 ? (
          <form action={markNotificationsRead}>
            <PendingButton className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-primary-d hover:bg-soft" pendingText="Marking…">Mark all as read</PendingButton>
          </form>
        ) : undefined}
      />
      <Card className="divide-y divide-line">
        {!(notes ?? []).length && <p className="p-4 text-sm text-muted">No notifications for {s.person.name} yet.</p>}
        {(notes ?? []).map((n) => (
          <div key={n.id} className={`flex gap-3 p-4 text-sm ${n.read_at ? "text-muted" : "bg-[#fbfaff]"}`}>
            <span aria-hidden className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.read_at ? "bg-transparent" : "bg-violet"}`} />
            <div className="flex-1">
              <p className={n.read_at ? "" : "font-medium text-ink"}>{n.text}{!n.read_at && <span className="sr-only"> (unread)</span>}</p>
              <p className="mt-1 text-xs text-muted">
                {timeAgo(n.created_at)}
                {n.link && <> · <Link href={n.link} className="font-semibold text-primary hover:underline">Open</Link></>}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
