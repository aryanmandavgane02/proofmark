"use client";
import { useFormStatus } from "react-dom";
import { IconReset } from "@/components/icons";

/** "Yes, start fresh": making a new copy of the workspace takes a moment, so the button says it is working. */
export function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(179_38_30/0.6)] transition hover:-translate-y-px hover:brightness-110 disabled:opacity-80"
    >
      {pending ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconReset className="h-4 w-4" />}
      {pending ? "Starting fresh…" : "Yes, start fresh"}
    </button>
  );
}
