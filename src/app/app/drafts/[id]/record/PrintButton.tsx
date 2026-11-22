"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-primary-d hover:bg-soft print:hidden">
      Print or save as PDF
    </button>
  );
}
