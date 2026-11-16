import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, StatusPill, btn, timeAgo } from "@/components/ui";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import { resetDemo, switchPerson } from "@/app/actions";

type Step = { title: string; detail: string; done: boolean; person: string; href: string; cta: string };

export default async function StartHere() {
  const s = await requireSession();
  const ws = s.workspace.id;
  const [{ data: drafts }, { data: decisions }, { data: events }] = await Promise.all([
    s.supabase.from("drafts").select("id, title, channel, status, updated_at, sample_key, reviewer_id").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    s.supabase.from("decisions").select("action").eq("workspace_id", ws).eq("is_sample", false),
    s.supabase.from("events").select("type").eq("workspace_id", ws),
  ]);
  const acts = new Set((decisions ?? []).map((d) => d.action));
  const types = new Set((events ?? []).map((e) => e.type));
  const firstDraft = (drafts ?? []).find((d) => d.sample_key === "diwali-post") ?? drafts?.[drafts.length - 1];
  const draftHref = firstDraft ? `/app/drafts/${firstDraft.id}` : "/app/drafts/new?sample=diwali-post";

  const inReview = (drafts ?? []).find((d) => d.status === "in_review");
  const reviewerName = s.people.find((p) => p.id === inReview?.reviewer_id)?.name ?? "Ritu";

  const steps: Step[] = [
    { title: "Check a draft", detail: "Load the sample Diwali Instagram post and press Check. Findings appear in seconds, each with its rule and a fix.", done: !!drafts?.length, person: "Arjun", href: "/app/drafts/new?sample=diwali-post", cta: "Open the sample post" },
    { title: "Accept a suggested fix", detail: "Pick a finding and press Accept fix. Proofmark saves a new version and checks it again.", done: acts.has("accept"), person: "Arjun", href: draftHref, cta: "Go to the draft" },
    { title: "Dispute a finding", detail: "Disagree with one, for example the tone finding, and give a reason. A reviewer will decide.", done: acts.has("dispute"), person: "Arjun", href: draftHref, cta: "Go to the draft" },
    { title: "Submit for review", detail: "Blockers must be fixed or disputed first. Proofmark routes the draft to the right reviewer and says why.", done: types.has("draft.submitted"), person: "Arjun", href: draftHref, cta: "Go to the draft" },
    { title: "Review and approve", detail: "Switch to the assigned reviewer, resolve any dispute with a reason, then approve. The approval is tied to this exact version.", done: types.has("draft.approved"), person: reviewerName, href: inReview ? `/app/drafts/${inReview.id}` : "/app/review", cta: inReview ? "Review the draft" : "Open the review queue" },
  ];
  const next = steps.find((st) => !st.done);
  const doneCount = steps.filter((st) => st.done).length;

  return (
    <>
      <PageTitle
        title={`Welcome, ${s.person.name}`}
        subtitle="Follow these five steps to see the whole workflow: a draft goes in, comes back with cited findings and fixes, and a person approves it. Each button switches you to the right person automatically."
      />
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary-d">Guided demo</h2>
          <span className="text-sm text-muted">{doneCount} of {steps.length} done</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-soft"><div className="h-2 rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
        <ol className="mt-4 space-y-3">
          {steps.map((st, i) => {
            const person = s.people.find((p) => p.name === st.person);
            const isNext = st === next;
            return (
              <li key={st.title} className={`flex flex-wrap items-start gap-3 rounded-lg border p-3 ${isNext ? "border-primary bg-soft" : "border-line"}`}>
                <span aria-hidden className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${st.done ? "bg-accent text-white" : "bg-[#e2e6f6] text-primary-d"}`}>
                  {st.done ? "✓" : i + 1}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-semibold text-ink">{st.title} <span className="font-normal text-muted">· as {st.person}</span></p>
                  <p className="text-sm text-muted">{st.detail}</p>
                </div>
                {person && (
                  <form action={switchPerson} className="w-full pl-9 sm:w-auto sm:pl-0">
                    <input type="hidden" name="person_id" value={person.id} />
                    <input type="hidden" name="back" value={st.href} />
                    <button className={isNext ? btn.primary : btn.secondary}>{st.done ? "Open again" : st.cta}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
        {!next && <p className="mt-4 rounded-lg bg-[#d8f0ea] p-3 text-sm text-[#0a5c4f]">You have run the whole workflow. Try your own content in <Link className="underline" href="/app/drafts/new">New draft</Link>, or look at the rulebook and facts behind each finding.</p>}
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary-d">Drafts</h2>
        <Link href="/app/drafts/new" className={btn.secondary}>New draft</Link>
      </div>
      <Card className="mt-3 divide-y divide-line">
        {(drafts ?? []).length === 0 && <p className="p-4 text-sm text-muted">No drafts yet. Start with step 1 above.</p>}
        {(drafts ?? []).map((d) => (
          <Link key={d.id} href={`/app/drafts/${d.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-soft">
            <span className="font-medium text-ink">{d.title}</span>
            <span className="text-sm text-muted">{CHANNEL_LABEL[d.channel as Channel]}</span>
            <span className="ml-auto text-xs text-muted">{timeAgo(d.updated_at)}</span>
            <StatusPill status={d.status} />
          </Link>
        ))}
      </Card>

      <form action={resetDemo} className="mt-10 text-right">
        <button className="text-xs text-muted underline">Reset this demo workspace</button>
      </form>
    </>
  );
}
