import Link from "next/link";
import { requireSession } from "@/lib/session";
import { LogoMark } from "@/components/Logo";
import { PersonSwitcher } from "./PersonSwitcher";
import { NavLinks } from "./NavLinks";
import { IconHome } from "@/components/icons";


export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const s = await requireSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="z-20 sm:sticky sm:top-0 border-b border-line/70 bg-surface/80 shadow-[0_1px_12px_-6px_rgb(31_42_107/0.15)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-2" title="Proofmark home page" aria-label="Proofmark home page">
              <LogoMark className="h-7 w-7 transition group-hover:rotate-[-8deg]" />
              <span className="font-display text-lg font-extrabold tracking-tight text-gradient-live">Proofmark</span>
            </Link>
            <Link href="/" className="shine inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-violet px-3 py-1.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.98]">
              <IconHome className="h-4 w-4" /> Home page
            </Link>
          </div>
          <PersonSwitcher people={s.people} activeId={s.person.id} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2.5 pt-2">
          <NavLinks />
        </div>
        {s.workspace.is_demo && (
          <div className="border-t border-line/70 bg-gradient-to-r from-[#eef0fb] via-[#f3eefc] to-[#e9f5f1] px-4 py-1.5 text-center text-xs text-muted">
            Demo workspace for the fictional brand <b>{s.workspace.brand_name}</b>. Everything here is private to you and uses made-up data.
          </div>
        )}
      </header>
      <main className="stagger mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
