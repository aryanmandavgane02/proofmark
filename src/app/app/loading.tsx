/** Shown instantly while a page in the app loads, so navigation never looks frozen. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-1 w-10 rounded-full bg-line" />
      <div className="h-7 w-64 rounded-lg bg-line/70" />
      <div className="h-4 w-full max-w-xl rounded bg-line/50" />
      <div className="grid gap-4 pt-2 lg:grid-cols-2">
        <div className="h-48 rounded-2xl border border-line/60 bg-surface/70" />
        <div className="h-48 rounded-2xl border border-line/60 bg-surface/70" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
