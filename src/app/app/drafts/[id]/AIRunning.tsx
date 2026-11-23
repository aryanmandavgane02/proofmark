"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * While the AI half of a check runs in the background, refresh the page so its findings appear on their own:
 * two seconds after the previous refresh has finished, never two at once. Refreshes and the person's actions wait in
 * one queue, so refreshes started on a fixed timer would pile up behind a slow server and hold up the next click.
 * The server marks a run that has not finished after 90 seconds as done without AI.
 * The elapsed time is only shown once the browser has its own clock reading, so server and browser never disagree.
 */
export function AIRunning({ startedAt }: { startedAt: string }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (refreshing) return;
    const t = setTimeout(() => startRefresh(() => router.refresh()), 2000);
    return () => clearTimeout(t);
  }, [refreshing, router]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = now === null ? 0 : Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-violet/30 bg-[#f1effd] p-4 text-sm text-primary-d">
      <span aria-hidden className="mt-0.5 h-4 w-4 flex-none animate-spin rounded-full border-2 border-violet/30 border-t-violet" />
      <div>
        <p className="font-semibold">AI checks are running{seconds >= 3 ? ` (${seconds} s)` : ""}…</p>
        <p className="mt-0.5 text-primary-d/80">
          The code findings below are ready. AI findings for tone, messaging and claims in context{" "}
          appear here on their own, usually within a few seconds. Submitting and approving wait until they are in.
        </p>
      </div>
    </div>
  );
}
