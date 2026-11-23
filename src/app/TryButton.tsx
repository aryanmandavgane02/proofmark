"use client";
import { useFormStatus } from "react-dom";

/** Opens one Round 3 improvement in the demo; on a first visit the same click sets up the demo workspace. */
export function TryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-surface px-4 py-2 text-sm font-semibold text-primary-d shadow-card transition hover:-translate-y-px hover:border-primary/60 hover:bg-soft disabled:opacity-80"
    >
      {pending && <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />}
      {pending ? "Opening your demo…" : label}
      {!pending && <span aria-hidden>→</span>}
    </button>
  );
}
