"use client";
import { createPortal, useFormStatus } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

/** After this long, a waiting action says so and tells the person what to do. */
const SLOW_MS = 10_000;

/**
 * A form's submit button: shows `pendingText` while the action runs. If the action is still running after
 * 10 seconds (a stalled connection, for example), a note says so, instead of "Sending…" staying on screen with no word.
 */
export function PendingButton({ children, pendingText, className, disabled }: { children: ReactNode; pendingText: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [pending]);
  return (
    <>
      <button className={className} disabled={disabled || pending}>
        {pending ? pendingText : children}
      </button>
      {slow && pending && createPortal(<SlowNote />, document.body)}
    </>
  );
}

function SlowNote() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div role="status" className="pointer-events-auto max-w-xl rounded-xl border border-amber/50 bg-[#fff6e5] px-4 py-3 text-sm font-medium text-[#6b4500] shadow-lift">
        This is taking longer than usual. If nothing changes in a few seconds,{" "}
        <button type="button" onClick={() => window.location.reload()} className="font-semibold underline underline-offset-2">
          reload the page
        </button>
        : anything already saved will be there.
      </div>
    </div>
  );
}
