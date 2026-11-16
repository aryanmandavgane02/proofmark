import { LogoMark } from "@/components/Logo";

const steps = [
  { t: "Submit a draft", d: "A post, an ad, an email or a document, before it is published." },
  { t: "Get cited findings", d: "Each issue shows the rule or fact it breaks, why, and a suggested fix." },
  { t: "A person approves", d: "Reviewers resolve disputes and approve. AI never approves anything." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex items-center gap-3">
        <LogoMark className="h-10 w-10" />
        <span className="text-2xl font-bold text-primary-d">Proofmark</span>
      </div>
      <h1 className="mt-10 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
        Brand guidelines as code.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Every draft is checked against approved rules, facts and assets before it is published. Every issue comes with
        its reason, its source and a suggested fix. A person always makes the final call.
      </p>
      <div className="mt-8">
        <span className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-semibold text-white opacity-80">
          Live demo opening soon
        </span>
      </div>
      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="rounded-xl border border-line bg-surface p-5">
            <span className="text-sm font-bold text-accent">Step {i + 1}</span>
            <h2 className="mt-1 font-semibold text-primary-d">{s.t}</h2>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </li>
        ))}
      </ol>
      <footer className="mt-auto pt-16 text-sm text-muted">
        Built for CodeZen 2026 by team SoloStack. Demo data is fictional.
      </footer>
    </main>
  );
}
