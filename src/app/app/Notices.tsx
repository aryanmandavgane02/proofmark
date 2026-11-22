"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Shown = { text: string; kind: string };

/**
 * Shows the message a server action sent back (`?notice=…&kind=…`, see src/lib/notice.ts) and removes it
 * from the address bar straight away, so a refresh does not show it again.
 */
export function Notices() {
  const params = useSearchParams();
  const text = params.get("notice");
  const kind = params.get("kind") ?? "error";
  const [seen, setSeen] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  // A new notice in the address bar replaces whatever is shown (React's "adjust state while rendering" pattern).
  if (text && text !== seen) {
    setSeen(text);
    setShown({ text, kind });
  }
  if (!text && seen) setSeen(null);

  useEffect(() => {
    if (!text) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    url.searchParams.delete("kind");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [text]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 10_000);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  const style =
    shown.kind === "success" ? "border-accent/40 bg-[#e8f4ec] text-[#0a5c4f]"
    : shown.kind === "info" ? "border-primary/30 bg-[#eef0fb] text-primary-d"
    : "border-red/40 bg-[#fdecea] text-[#8a1c12]";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div role={shown.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lift ${style}`}>
        <span>{shown.text}</span>
        <button type="button" onClick={() => setShown(null)} className="-mr-1 rounded px-1 text-lg leading-none opacity-70 hover:opacity-100" aria-label="Dismiss this message">×</button>
      </div>
    </div>
  );
}
