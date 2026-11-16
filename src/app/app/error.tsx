"use client";
import Link from "next/link";

// Shown if something fails on the server. Nothing the visitor saved is lost.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-2xl font-bold text-primary-d">Something went wrong</h1>
      <p className="mt-2 text-muted">Proofmark could not finish that step. Your drafts and decisions are saved. Try again, or go back to the start.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-d">Try again</button>
        <Link href="/app" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-primary-d hover:bg-soft">Start here</Link>
      </div>
    </div>
  );
}
