import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card, PageTitle, StatusPill, btn, timeAgo } from "@/components/ui";
import { CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import { resetDemo, switchPerson } from "@/app/actions";
import { IconBell, IconChart, IconCheck, IconFile, IconImage, IconReset, IconUser, IconPages } from "@/components/icons";
import { CloseDetails } from "./CloseDetails";

type Step = { title: string; detail: string; done: boolean; person: string; href: string; cta: string };

export default async function StartHere() {
  const s = await requireSession();
  const ws = s.workspace.id;
  const [{ data: allDrafts }, { data: decisions }, { data: events }, { data: openAlertRows }] = await Promise.all([
    s.supabase.from("drafts").select("id, title, channel, status, updated_at, sample_key, reviewer_id, is_sample").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    s.supabase.from("decisions").select("action").eq("workspace_id", ws).eq("is_sample", false),
    s.supabase.from("events").select("type").eq("workspace_id", ws),
    s.supabase.from("fact_alerts").select("draft_id").eq("workspace_id", ws).eq("status", "open"),
  ]);
  const outOfDate = new Set((openAlertRows ?? []).map((a) => a.draft_id));
  const openAlerts = (openAlertRows ?? []).length;
  // The approved sample library is there for outdated-content alerts; the guided steps count only the visitor's drafts.
  const drafts = (allDrafts ?? []).filter((d) => !d.is_sample);
  const library = (allDrafts ?? []).filter((d) => d.is_sample);
  const meera = s.people.find((p) => p.role === "manager");
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
          <h2 className="flex items-center gap-2 font-semibold text-primary-d"><span aria-hidden className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-violet" /></span>Guided demo</h2>
          <span className="text-sm text-muted">{doneCount} of {steps.length} done</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-soft"><div className="bar-grow h-full rounded-full bg-gradient-to-r from-accent via-[#14a08a] to-violet" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
        <ol className="mt-4 space-y-3">
          {steps.map((st, i) => {
            const person = s.people.find((p) => p.name === st.person);
            const isNext = st === next;
            return (
              <li key={st.title} className={`flex flex-wrap items-start gap-3 rounded-xl border p-3 transition ${isNext ? "border-violet/50 bg-gradient-to-r from-[#f1effd] to-[#eef4fb] shadow-card" : st.done ? "border-line bg-[#f6fbf9]" : "border-line hover:border-primary/30"}`}>
                <span aria-hidden className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${st.done ? "animate-pop bg-accent text-white shadow-[0_4px_10px_-4px_rgb(13_122_104/0.7)]" : isNext ? "bg-gradient-to-br from-primary to-violet text-white shadow-glow" : "bg-[#e2e6f6] text-primary-d"}`}>
                  {st.done ? <IconCheck className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink">
                    {st.title}
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e2e6f6] px-2 py-0.5 text-xs font-semibold text-primary-d">
                      <IconUser className="h-3.5 w-3.5" /> Done by {st.person}{person ? ` (${person.role === "reviewer" ? person.title.toLowerCase() : person.role === "manager" ? "brand manager" : "creator"})` : ""}
                    </span>
                  </p>
                  <p className="text-sm text-muted">{st.detail}</p>
                  {isNext && person && person.id !== s.person.id && (
                    <p className="mt-1 text-xs font-semibold text-violet">You&apos;re acting as {s.person.name}. The button switches you to {st.person}.</p>
                  )}
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

      <section aria-labelledby="more" className="mt-6">
        <h2 id="more" className="font-semibold text-primary-d">More to try</h2>
        {meera && (
          <form action={switchPerson} className="mt-3">
            <input type="hidden" name="person_id" value={meera.id} />
            <input type="hidden" name="back" value="/app/facts#fact-F-12" />
            <button className="glow-card group flex w-full gap-3 rounded-2xl border border-line/80 bg-surface p-4 text-left shadow-card transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift">
              <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#fde0dd] to-[#fff4ea] text-[#8a1c12] transition group-hover:scale-110"><IconBell className="h-5 w-5" /></span>
              <span>
                <span className="block font-semibold text-primary group-hover:underline">Change a fact and see what goes out of date</span>
                <span className="block text-sm text-muted">
                  As Meera, edit F-12 (the customer count): every approved draft that quoted it is listed, its owner is told, and one click re-checks it.
                  {openAlerts ? ` ${openAlerts} approved draft${openAlerts === 1 ? " is" : "s are"} already out of date.` : ""}
                </span>
              </span>
            </button>
          </form>
        )}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/app/drafts/new?mode=document&sample=diwali-deck", t: "Check a PDF deck", d: "A 10-page deck: every page checked, each finding with its page, fonts outside the brand typefaces flagged.", Icon: IconPages, tint: "from-[#f1effd] to-[#fbf7ef] text-violet" },
            { href: "/app/drafts/new?sample=diwali-ad", t: "Check an image ad", d: "Logo, brand colours, text in the picture and alt text.", Icon: IconImage, tint: "from-[#fde7d6] to-[#fff4ea] text-[#8a3a00]" },
            { href: "/app/rulebook/import", t: "Import rules from a PDF", d: "As Meera: the AI drafts rules, code checks every quote, you approve and publish.", Icon: IconFile, tint: "from-[#e2e6f6] to-[#f1effd] text-primary-d" },
            { href: "/app/insights", t: "See insights", d: "Repeated mistakes, a rule flagged as unclear, and AI-proposed clearer wording.", Icon: IconChart, tint: "from-[#d8f0ea] to-[#eef8f5] text-[#0a5c4f]" },
          ].map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="glow-card group flex h-full gap-3 rounded-2xl border border-line/80 bg-surface p-4 shadow-card transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift">
                <span aria-hidden className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${m.tint} transition group-hover:scale-110`}><m.Icon className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold text-primary group-hover:underline">{m.t}</span>
                  <span className="block text-sm text-muted">{m.d}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary-d">Drafts</h2>
        <Link href="/app/drafts/new" className={btn.secondary}>New draft</Link>
      </div>
      <Card className="mt-3 divide-y divide-line">
        {drafts.length === 0 && <p className="p-4 text-sm text-muted">No drafts yet. Start with step 1 above.</p>}
        {drafts.map((d) => (
          <Link key={d.id} href={`/app/drafts/${d.id}`} className="flex flex-wrap items-center gap-3 p-4 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-soft">
            <span className="font-medium text-ink">{d.title}</span>
            <span className="text-sm text-muted">{CHANNEL_LABEL[d.channel as Channel]}</span>
            {outOfDate.has(d.id) && <span className="rounded bg-[#fde0dd] px-1.5 py-0.5 text-xs font-semibold text-[#8a1c12]">Out of date</span>}
            <span className="ml-auto text-xs text-muted">{timeAgo(d.updated_at)}</span>
            <StatusPill status={d.status} />
          </Link>
        ))}
      </Card>

      {library.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-primary-d">Approved sample content ({library.length}) <span className="font-normal text-muted">· seeded so that outdated-content alerts have approved content to watch</span></summary>
          <Card className="mt-3 divide-y divide-line">
            {library.map((d) => (
              <Link key={d.id} href={`/app/drafts/${d.id}`} className="flex flex-wrap items-center gap-3 p-4 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-soft">
                <span className="font-medium text-ink">{d.title}</span>
                <span className="text-sm text-muted">{CHANNEL_LABEL[d.channel as Channel]}</span>
                <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">Sample</span>
                {outOfDate.has(d.id) && <span className="rounded bg-[#fde0dd] px-1.5 py-0.5 text-xs font-semibold text-[#8a1c12]">Out of date</span>}
                <span className="ml-auto text-xs text-muted">{timeAgo(d.updated_at)}</span>
                <StatusPill status={d.status} />
              </Link>
            ))}
          </Card>
        </details>
      )}

      <div className="mt-10 flex justify-end">
        <details className="group w-full max-w-md rounded-2xl border border-line/80 bg-surface/90 p-1 shadow-card backdrop-blur open:p-4 sm:w-auto">
          <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-red/30 bg-surface px-4 py-2 text-sm font-semibold text-red transition hover:-translate-y-px hover:bg-red/5 group-open:hidden [&::-webkit-details-marker]:hidden">
            <IconReset className="h-4 w-4" /> Reset this demo workspace
          </summary>
          <p className="text-sm font-semibold text-ink">Start the demo again from the beginning?</p>
          <p className="mt-1 text-sm text-muted">This deletes your drafts, decisions and rule changes in this workspace and gives you a fresh copy. It cannot be undone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={resetDemo}>
              <button className="inline-flex items-center gap-2 rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(179_38_30/0.6)] transition hover:-translate-y-px hover:brightness-110"><IconReset className="h-4 w-4" /> Yes, reset everything</button>
            </form>
            <CloseDetails className={btn.secondary}>Cancel</CloseDetails>
          </div>
        </details>
      </div>
    </>
  );
}
