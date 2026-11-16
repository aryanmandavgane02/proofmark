import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { getSession } from "@/lib/session";
import { startDemo } from "./actions";
import { StartButton } from "./StartButton";

const steps = [
  { t: "Submit a draft", d: "A post, an ad, an email or web copy, before it is published." },
  { t: "Get cited findings", d: "Each issue shows the rule or fact it breaks, why, and a suggested fix you can accept." },
  { t: "A person approves", d: "Disputes are resolved and content is approved by people. AI never approves anything." },
];

export default async function Home() {
  const s = await getSession();
  const hasDemo = !!s?.workspace;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex items-center gap-3">
        <LogoMark className="h-10 w-10" />
        <span className="text-2xl font-bold text-primary-d">Proofmark</span>
      </div>
      <h1 className="mt-10 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">Brand guidelines as code.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Every draft is checked against approved rules, facts and assets before it is published. Every issue comes with its
        reason, its source and a suggested fix. A person always makes the final call.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {hasDemo ? (
          <>
            <Link href="/app" className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-d">
              Continue your demo
            </Link>
            <span className="text-sm text-muted">Your private demo workspace is still here.</span>
          </>
        ) : (
          <form action={startDemo}>
            <StartButton />
          </form>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">
        No sign-up. You get a private copy of a fictional snack brand, <b>Urja Bites</b>, with its brand rules, approved facts and
        sample drafts, and you can act as the creator, the brand manager or the reviewers.
      </p>
      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {steps.map((st, i) => (
          <li key={st.t} className="rounded-xl border border-line bg-surface p-5">
            <span className="text-sm font-bold text-accent">Step {i + 1}</span>
            <h2 className="mt-1 font-semibold text-primary-d">{st.t}</h2>
            <p className="mt-1 text-sm text-muted">{st.d}</p>
          </li>
        ))}
      </ol>
      <footer className="mt-auto pt-16 text-sm text-muted">
        Built for CodeZen 2026 by team SoloStack. Demo data is fictional.{" "}
        <a className="underline" href="https://github.com/aryanmandavgane02/proofmark">Source code</a>
      </footer>
    </main>
  );
}
