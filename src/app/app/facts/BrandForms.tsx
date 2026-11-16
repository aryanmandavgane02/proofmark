"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addColor, addTerm, saveFact, type BrandFormState } from "@/app/brand-actions";
import { btn, input } from "@/components/ui";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className={btn.primary} disabled={pending}>{pending ? "Saving…" : label}</button>;
}
function Result({ state }: { state: BrandFormState }) {
  if (state?.error) return <p role="alert" className="text-sm text-red">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-accent">{state.ok}</p>;
  return null;
}

export type FactRow = { code: string; statement: string; value: number | null; unit: string | null; keywords: string[]; source: string; owner: string; expires_on: string | null; restricted: boolean };

export function FactForm({ fact, nextCode }: { fact?: FactRow; nextCode?: string }) {
  const [state, action] = useActionState<BrandFormState, FormData>(saveFact, undefined);
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-line bg-soft p-3 text-sm sm:grid-cols-2">
      <input type="hidden" name="mode" value={fact ? "edit" : "add"} />
      <label className="text-xs font-semibold text-muted">Code<input name="code" defaultValue={fact?.code ?? nextCode} readOnly={!!fact} className={input} /></label>
      <label className="text-xs font-semibold text-muted sm:col-span-2">Approved fact (as it may be published)<input name="statement" required defaultValue={fact?.statement} className={input} placeholder="e.g. 40,000+ customers, as of Dec 2026." /></label>
      <label className="text-xs font-semibold text-muted">Number, if any<input name="value" defaultValue={fact?.value ?? ""} className={input} placeholder="40000" /></label>
      <label className="text-xs font-semibold text-muted">Kind of number
        <select name="unit" defaultValue={fact?.unit ?? ""} className={input}><option value="">Not a number</option><option value="count">Count of people</option><option value="%">Percentage (offer)</option><option value="inr">Price in rupees</option><option value="g">Grams (protein)</option><option value="rating">Rating out of 5</option></select>
      </label>
      <label className="text-xs font-semibold text-muted sm:col-span-2">Keywords that link a claim to this fact (comma-separated)<input name="keywords" defaultValue={fact?.keywords.join(", ")} className={input} placeholder="customers, people, fans" /></label>
      <label className="text-xs font-semibold text-muted">Source<input name="source" required defaultValue={fact?.source} className={input} placeholder="Sales dashboard, 1 Dec 2026" /></label>
      <label className="text-xs font-semibold text-muted">Owner<input name="owner" required defaultValue={fact?.owner} className={input} placeholder="Sales" /></label>
      <label className="text-xs font-semibold text-muted">Valid until (optional)<input name="expires_on" type="date" defaultValue={fact?.expires_on ?? ""} className={input} /></label>
      <label className="flex items-center gap-2 self-end text-xs font-semibold text-muted"><input type="checkbox" name="restricted" defaultChecked={fact?.restricted} /> Confidential (hidden from creators and never sent to AI)</label>
      <div className="flex items-center gap-3 sm:col-span-2"><Save label={fact ? "Save fact" : "Add fact"} /><Result state={state} /></div>
    </form>
  );
}

export function TermForm() {
  const [state, action] = useActionState<BrandFormState, FormData>(addTerm, undefined);
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-line bg-soft p-3 text-sm sm:grid-cols-3">
      <label className="text-xs font-semibold text-muted">Use<input name="preferred" required className={input} placeholder="protein bar" /></label>
      <label className="text-xs font-semibold text-muted">Instead of (comma-separated)<input name="avoid" required className={input} placeholder="energy bar, candy bar" /></label>
      <label className="text-xs font-semibold text-muted">Why<input name="reason" className={input} placeholder="Describes the product accurately." /></label>
      <label className="flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" name="case_sensitive" /> Exact capitals matter (names)</label>
      <div className="flex items-center gap-3 sm:col-span-2"><Save label="Add term" /><Result state={state} /></div>
    </form>
  );
}

export function ColorForm() {
  const [state, action] = useActionState<BrandFormState, FormData>(addColor, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-soft p-3 text-sm">
      <label className="text-xs font-semibold text-muted">Name<input name="name" required className={input} placeholder="Festive Gold" /></label>
      <label className="text-xs font-semibold text-muted">Hex colour<input name="hex" required pattern="#[0-9A-Fa-f]{6}" className={input} placeholder="#E0B040" /></label>
      <Save label="Add colour" /><Result state={state} />
    </form>
  );
}
