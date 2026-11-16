"use client";
import { useFormStatus } from "react-dom";

export function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-d disabled:opacity-70">
      {pending ? "Setting up your demo workspace…" : "Start the live demo (no sign-up)"}
    </button>
  );
}
