"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * While the AI half of a check runs in the background, refresh the page every two seconds so its findings
 * appear on their own. The server marks a run that has not finished after two minutes as done without AI.
 */
export function AIRunning({ startedAt }: { startedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [router]);
  const seconds = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
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
