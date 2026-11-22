"use client";
import { useState } from "react";

/** Copies the exact approved text, so what is published is what was approved. */
export function CopyText({ text, label = "Copy approved text" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
      className="rounded-lg border border-[#0a5c4f]/30 bg-surface px-3 py-1.5 text-xs font-semibold text-[#0a5c4f] hover:bg-[#eef7f4]"
    >
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed: select the text instead" : label}</span>
    </button>
  );
}
