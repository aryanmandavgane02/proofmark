/**
 * Where a draft is in its review, and whose turn it is: the writer fixes and submits, a reviewer decides, then it is
 * approved. Added after user tests in Round 3: people were unsure when a draft had been submitted and who acts next.
 */
export function ReviewSteps({ status, writer, reviewer, approver }: { status: string; writer: string; reviewer: string | null; approver: string | null }) {
  const at = status === "approved" ? 4 : status === "in_review" ? 2 : 1;
  const steps = [
    { label: status === "changes_requested" ? "Make the changes" : "Fix and submit", who: writer },
    { label: "Review", who: reviewer ?? "Picked on submit" },
    { label: "Approved", who: approver ?? "" },
  ];
  return (
    <ol className="mb-4 grid grid-cols-3 gap-1.5 text-xs" aria-label="Review steps">
      {steps.map((step, i) => {
        const n = i + 1;
        const state = n < at ? "done" : n === at ? "now" : "next";
        const style =
          state === "done" ? "border-accent/40 bg-[#e8f4ec] text-[#0a5c4f]"
          : state === "now" ? "border-primary bg-[#eef0fb] text-primary-d ring-1 ring-primary/30"
          : "border-line text-muted";
        return (
          <li key={n} aria-current={state === "now" ? "step" : undefined} className={`min-w-0 rounded-lg border px-2 py-1.5 ${style}`}>
            <span className="block font-semibold">{state === "done" ? "✓" : `${n}.`} {step.label}</span>
            {step.who && <span className="block [overflow-wrap:anywhere]">{state === "now" ? <>Now: <b>{step.who}</b></> : step.who}</span>}
          </li>
        );
      })}
    </ol>
  );
}
