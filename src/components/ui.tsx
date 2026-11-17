import type { ReactNode } from "react";

export const btn = {
  primary: "shine inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-violet px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
  secondary: "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-primary-d shadow-card transition hover:-translate-y-px hover:border-primary/40 hover:bg-soft active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  accent: "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent to-[#0b6b5b] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_-6px_rgb(13_122_104/0.6)] transition hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-lg border border-red/40 bg-surface px-4 py-2 text-sm font-semibold text-red transition hover:-translate-y-px hover:bg-red/5 active:scale-[0.98]",
  small: "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold",
};

export const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none";

const SEV: Record<string, string> = {
  blocker: "bg-red text-white",
  major: "bg-amber text-white",
  minor: "bg-muted text-white",
};
export function SeverityChip({ severity }: { severity: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SEV[severity] ?? SEV.minor}`}>{severity}</span>;
}

export function CategoryChip({ category }: { category: string }) {
  return <span className="rounded-full bg-[#e2e6f6] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-d">{category}</span>;
}

const LABEL: Record<string, [string, string]> = {
  code: ["Verified by code", "bg-[#d8f0ea] text-[#0a5c4f]"],
  ai_verified: ["AI · evidence verified", "bg-[#ebe4fb] text-[#4b2a9c]"],
  needs_judgment: ["Needs human judgment", "bg-[#ffecc7] text-[#7a3d00]"],
};
export function LabelChip({ label }: { label: string }) {
  const [text, cls] = LABEL[label] ?? LABEL.code;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{text}</span>;
}

const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "bg-soft text-primary-d"],
  in_review: ["In review", "bg-[#e2e6f6] text-primary-d"],
  changes_requested: ["Changes requested", "bg-[#ffecc7] text-[#7a3d00]"],
  approved: ["Approved", "bg-[#d8f0ea] text-[#0a5c4f]"],
};
export function StatusPill({ status }: { status: string }) {
  const [text, cls] = STATUS[status] ?? STATUS.draft;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{text}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line/80 bg-surface shadow-card ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <span aria-hidden className="mb-2 block h-1 w-10 rounded-full bg-gradient-to-r from-primary via-violet to-accent" />
        <h1 className="text-2xl font-extrabold tracking-tight text-primary-d sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
