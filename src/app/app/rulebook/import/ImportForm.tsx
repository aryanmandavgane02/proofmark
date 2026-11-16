"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importGuide, type BrandFormState } from "@/app/brand-actions";
import { Card, btn } from "@/components/ui";

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button className={btn.primary} disabled={pending}>{pending ? "Reading the document and drafting rules…" : "Import from my PDF"}</button>
    </div>
  );
}

function SampleButton({ value, label }: { value: string; label: string }) {
  const { pending } = useFormStatus();
  return <button name="sample" value={value} className={btn.secondary} disabled={pending}>{pending ? "Working…" : label}</button>;
}

export function ImportForm() {
  const [state, action] = useActionState<BrandFormState, FormData>(importGuide, undefined);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold text-primary-d">Try it with the sample update</h2>
        <p className="mt-1 text-sm text-muted">A 2-page &ldquo;Guideline update, November 2026&rdquo; for Urja Bites with four new rules (paid partnerships, competitors, Indian number style, festivals).</p>
        <form action={action} className="mt-3 flex flex-wrap gap-2">
          <SampleButton value="update" label="Import the November 2026 update" />
          <a className="self-center text-sm text-primary underline" href="/samples/urja-guideline-update-nov-2026.pdf" target="_blank">View the PDF</a>
        </form>
        <div className="mt-3 text-xs text-muted">Importing the full brand guide instead shows the duplicate check: its rules are already in the rulebook, so they are listed as not imported. <form action={action} className="inline"><button name="sample" value="full" className="underline">Import the full guide</button></form></div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold text-primary-d">Or use your own PDF</h2>
        <form action={action} className="mt-3 space-y-3">
          <input name="file" type="file" accept="application/pdf" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:font-semibold file:text-primary-d" aria-label="Brand guide PDF" />
          <p className="text-xs text-muted">Up to 4 MB and 40 pages, with real text (not scanned images). Uses one AI request. This demo runs on a free AI tier, so use public or made-up documents only.</p>
          <Buttons />
        </form>
      </Card>
      {state?.error && <p role="alert" className="rounded-lg bg-red/10 p-3 text-sm text-red lg:col-span-2">{state.error}</p>}
    </div>
  );
}
