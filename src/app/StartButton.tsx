"use client";
import { useFormStatus } from "react-dom";

export function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="shine group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-violet px-6 py-3.5 font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:opacity-80"
    >
      {pending && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? "Setting up your demo workspace…" : "Start the live demo (no sign-up)"}
      {!pending && <span aria-hidden className="transition group-hover:translate-x-1">→</span>}
    </button>
  );
}
