import Link from "next/link";
import { CODE_CHECK_COUNT } from "@/lib/checks";
import { LogoMark } from "@/components/Logo";
import { IconArrow, IconBell, IconBolt, IconBook, IconCheck, IconPages, IconPen, IconReset, IconShield, IconSpark, IconTrail, IconUser } from "@/components/icons";
import { getSession } from "@/lib/session";
import { resetDemo, startDemo, tryImprovement } from "./actions";
import { CloseDetails } from "./app/CloseDetails";
import { ResetButton } from "./ResetButton";
import { StartButton } from "./StartButton";
import { TryButton } from "./TryButton";

// The three Round 3 improvements, each one click from the first page a visitor sees, as the person who would use it.
const improvements = [
  { key: "documents", t: "PDF documents and decks", Icon: IconPages, tint: "from-[#f1effd] to-[#fbf7ef] text-violet", cta: "Check the sample deck, as Arjun",
    d: "Upload a deck exported from PowerPoint, Google Slides, Canva or Keynote. Every page is checked, each finding names its page, fonts outside the brand typefaces are flagged, and the reviewer approves the exact file." },
  { key: "alerts", t: "Out-of-date alerts", Icon: IconBell, tint: "from-[#fde0dd] to-[#fff4ea] text-[#8a1c12]", cta: "Change fact F-12, as Meera",
    d: "Change an approved fact, such as the customer count, and every approved draft that quoted the old figure is listed, its owner is told, and one click re-checks it." },
  { key: "replay", t: "Rule-change replay", Icon: IconSpark, tint: "from-[#e2e6f6] to-[#eef8f5] text-primary-d", cta: "Reword rule MSG-01, as Meera",
    d: "Reword an unclear rule, and before it is published, Proofmark replays it against every past decision: what would change, and whether it fits what people decided better." },
];

const steps = [
  { t: "Submit a draft", d: "A post, an ad, an email, web copy or a PDF deck, before it is published.", Icon: IconPen },
  { t: "Get cited findings", d: "Each issue shows the rule or fact it breaks, why, and a suggested fix you can accept.", Icon: IconBook },
  { t: "A person approves", d: "Disputes are resolved and content is approved by people. AI never approves anything.", Icon: IconUser },
];

// Numbers from the repository's own tests (eval/RESULTS.md, e2e/, scripts/rls-check.ts)
const stats = [
  { n: String(CODE_CHECK_COUNT), l: "code checks run before any AI" },
  { n: "100%", l: "of planted problems found by code in the scored test set" },
  { n: "32 / 32", l: "direct database and storage attacks refused" },
  { n: "0", l: "approvals made by AI: a person decides" },
];

const trust = [
  { t: "Proof check", d: "An AI finding is shown only if its quote is really in the draft and its rule is approved.", Icon: IconShield },
  { t: "Cited to the page", d: "Every rule links back to the exact sentence and page of the brand guide.", Icon: IconBook },
  { t: "Full audit trail", d: "Each approval is tied to one exact version. Any later edit withdraws it.", Icon: IconTrail },
];

const demoPeople = [
  { name: "Arjun", role: "Creator at the agency", does: "writes drafts, accepts fixes, disputes findings" },
  { name: "Meera", role: "Brand manager", does: "rules, facts, insights; approves anything" },
  { name: "Ritu", role: "Legal and compliance", does: "reviews claims, decides disputes" },
  { name: "Kabir", role: "Design lead", does: "reviews visual findings" },
];

/** The organisers suggested putting demo credentials on the site; Proofmark has no login, so this says so plainly. */
function DemoAccess() {
  return (
    <div className="mt-5 max-w-xl rounded-2xl border border-line/80 bg-surface/90 p-4 shadow-card backdrop-blur" aria-labelledby="demo-access">
      <h2 id="demo-access" className="text-sm font-bold text-primary-d">Demo access: no username, no password</h2>
      <p className="mt-1 text-sm text-muted">
        The button above signs you in to your own private demo. You get four demo people; switch between them any time with
        {" "}<b className="text-ink">&ldquo;Acting as&rdquo;</b> at the top of the app. The guided checklist switches for you.
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {demoPeople.map((p) => (
          <li key={p.name} className="rounded-lg bg-soft px-3 py-2">
            <b className="text-ink">{p.name}</b> <span className="text-muted">· {p.role}</span>
            <span className="block text-xs text-muted">{p.does}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A looping, decorative preview of a check: the draft, two findings popping in, and the approval stamp. */
function Preview() {
  return (
    <div aria-hidden className="relative animate-float">
      <div className="absolute -inset-6 animate-[pulse_5s_ease-in-out_infinite] rounded-[2rem] bg-gradient-to-br from-violet/35 via-primary/15 to-accent/35 blur-2xl" />
      <div className="spin-border relative rounded-2xl shadow-lift">
      <div className="relative rounded-[calc(1rem-1px)] bg-surface p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-primary-d">Diwali offer post · Instagram</span>
          <span className="flex items-center gap-1 rounded-full bg-[#e2e6f6] px-2 py-0.5 font-semibold text-primary-d"><IconBolt className="h-3 w-3" /> checked in 0.2 s</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          <mark className="rounded bg-[#fde2e0] px-0.5 text-ink underline decoration-red decoration-2 underline-offset-4">India&apos;s #1 protein bar</mark>, trusted by{" "}
          <mark className="rounded bg-[#ffecc7] px-0.5 text-ink underline decoration-amber decoration-2 underline-offset-4">50,000+ gym-goers</mark>. Grab 20% off this Diwali.
        </p>
        <div className="mt-4 space-y-2.5">
          <div className="animate-pop rounded-xl border border-line border-l-4 border-l-red bg-surface p-3" style={{ animationDelay: "0.5s" }}>
            <div className="flex gap-1.5"><span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">Blocker</span><span className="rounded-full bg-[#d8f0ea] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0a5c4f]">Verified by code</span></div>
            <p className="mt-1.5 text-xs text-ink">A ranking with no source. <b className="text-primary-d">CLAIM-02</b> · Brand guide p. 14</p>
          </div>
          <div className="animate-pop rounded-xl border border-line border-l-4 border-l-amber bg-surface p-3" style={{ animationDelay: "1s" }}>
            <div className="flex gap-1.5"><span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold uppercase text-white">Major</span><span className="rounded-full bg-[#d8f0ea] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0a5c4f]">Verified by code</span></div>
            <p className="mt-1.5 text-xs text-ink">Fact F-12 says 35,000+. <span className="font-semibold text-accent">Fix: “35,000+ customers”</span></p>
          </div>
        </div>
        <div className="animate-pop mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d8f0ea] to-[#e6f4ef] px-3 py-2 text-sm font-semibold text-[#0a5c4f]" style={{ animationDelay: "1.6s" }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white"><IconCheck className="h-4 w-4" /></span>
          Approved by Ritu (legal) · version 2
        </div>
      </div>
      </div>
    </div>
  );
}

// Starting the demo creates a private workspace.
export const maxDuration = 60;

// Why a demo could not be started (set by the start actions, see ensureDemo in actions.ts).
const DEMO_PROBLEM: Record<string, string> = {
  busy: "Too many new demos were started from this network in the last hour, so the sign-in service asked us to wait. Please try again in a few minutes. A demo you already started in this browser is still here.",
  failed: "The demo could not be set up just now. Please try again in a moment.",
};

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  // Only the listed reasons: a plain lookup would also answer to built-in names such as "constructor".
  const key = String(sp.demo ?? "");
  const problem = Object.hasOwn(DEMO_PROBLEM, key) ? DEMO_PROBLEM[key] : null;
  const s = await getSession();
  const hasDemo = !!s?.workspace;
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="dot-grid absolute inset-0 opacity-60" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold tracking-tight text-gradient-live">Proofmark</span>
        </div>
        <a className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary-d underline underline-offset-4 hover:bg-surface" href="https://github.com/aryanmandavgane02/proofmark">Source code</a>
      </header>

      <main className="stagger mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <section>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-primary-d shadow-card">
            <span aria-hidden className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            Live demo · CodeZen 2026
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Brand guidelines <span className="block text-gradient-live">as code.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Every draft is checked against approved rules, facts and assets before it is published. Every issue comes with its
            reason, its source and a suggested fix. A person always makes the final call.
          </p>
          {problem && (
            <p role="alert" className="mt-6 max-w-xl rounded-xl border border-amber/50 bg-[#fff6e5] p-3 text-sm font-medium text-[#6b4500]">{problem}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasDemo ? (
              <>
                <Link href="/app" className="shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet px-6 py-3.5 font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110">
                  Continue your demo <IconArrow className="h-4 w-4" />
                </Link>
                <span className="text-sm text-muted">Your private demo workspace is still here.</span>
                <details className="group w-full">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-surface/90 px-5 py-2.5 text-sm font-semibold text-primary-d shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface hover:shadow-lift active:translate-y-0 active:scale-[0.98] group-open:hidden [&::-webkit-details-marker]:hidden">
                    <IconReset className="h-4 w-4" /> Start over with a fresh workspace
                  </summary>
                  <div className="mt-1 max-w-md rounded-2xl border border-line/80 bg-surface/95 p-4 shadow-card backdrop-blur">
                    <p className="text-sm font-semibold text-ink">Start the demo again from the beginning?</p>
                    <p className="mt-1 text-sm text-muted">This deletes your drafts, decisions and rule changes and gives you a fresh copy of the Urja Bites workspace. It cannot be undone.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={resetDemo}>
                        <ResetButton />
                      </form>
                      <CloseDetails className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-primary-d shadow-card transition hover:bg-soft">Cancel</CloseDetails>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <form action={startDemo}>
                <StartButton />
              </form>
            )}
          </div>
          <p className="mt-4 max-w-xl text-sm text-muted">
            No sign-up. You get a private copy of a fictional snack brand, <b className="text-ink">Urja Bites</b>, with its brand rules, approved facts and
            sample drafts, and you can act as the creator, the brand manager or the reviewers.
          </p>
          <a href="#new" className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary-d">
            New since Round 2: try each of the three improvements in one click ↓
          </a>
          <DemoAccess />
        </section>
        <Preview />
      </main>

      <section aria-labelledby="new" className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
        <h2 id="new" className="text-center text-2xl font-extrabold tracking-tight text-primary-d">New since Round 2</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted">Three improvements, each one click from here. Each opens in your private demo, as the person who would use it.</p>
        <ul className="stagger mt-6 grid gap-4 md:grid-cols-3">
          {improvements.map((x) => (
            <li key={x.key} className="glow-card flex flex-col rounded-2xl border border-violet/30 bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span aria-hidden className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${x.tint}`}><x.Icon className="h-5 w-5" /></span>
                <h3 className="font-semibold text-primary-d">{x.t}</h3>
              </div>
              <p className="mt-3 flex-1 text-sm text-muted">{x.d}</p>
              <form action={tryImprovement} className="mt-4">
                <input type="hidden" name="try" value={x.key} />
                <TryButton label={x.cta} />
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="In numbers" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <ul className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((x) => (
            <li key={x.l} className="glow-card rounded-2xl border border-line/80 bg-surface/90 p-4 shadow-card backdrop-blur transition hover:-translate-y-1 hover:shadow-lift">
              <p className="font-display text-2xl font-extrabold text-gradient sm:text-3xl">{x.n}</p>
              <p className="mt-1 text-xs text-muted sm:text-sm">{x.l}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <h2 id="how" className="text-center text-2xl font-extrabold tracking-tight text-primary-d">How it works</h2>
        <ol className="stagger mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.t} className="glow-card group relative rounded-2xl border border-line/80 bg-surface p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet text-white shadow-glow transition group-hover:scale-110"><st.Icon className="h-5 w-5" /></span>
                <span className="text-sm font-bold text-accent">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-primary-d">{st.t}</h3>
              <p className="mt-1 text-sm text-muted">{st.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="trust" className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6">
        <h2 id="trust" className="text-center text-2xl font-extrabold tracking-tight text-primary-d">Why you can trust a finding</h2>
        <ul className="stagger mt-6 grid gap-4 sm:grid-cols-3">
          {trust.map((t) => (
            <li key={t.t} className="glow-card flex gap-3 rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#d8f0ea] text-[#0a5c4f]"><t.Icon className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-primary-d">{t.t}</h3>
                <p className="mt-0.5 text-sm text-muted">{t.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto mt-auto w-full max-w-6xl px-4 pb-8 pt-16 text-sm text-muted sm:px-6">
        Built for CodeZen 2026 by team SoloStack. Demo data is fictional.{" "}
        <a className="underline" href="https://github.com/aryanmandavgane02/proofmark">Source code</a>
      </footer>
    </div>
  );
}
