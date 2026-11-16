import Link from "next/link";
import { requireSession } from "@/lib/session";
import { LogoMark } from "@/components/Logo";
import { PersonSwitcher } from "./PersonSwitcher";

const NAV = [
  { href: "/app", label: "Start here" },
  { href: "/app/drafts/new", label: "New draft" },
  { href: "/app/review", label: "Review queue" },
  { href: "/app/rulebook", label: "Rulebook" },
  { href: "/app/facts", label: "Facts & terms" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const s = await requireSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-bold text-primary-d">Proofmark</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 font-medium text-muted hover:bg-soft hover:text-primary-d">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <PersonSwitcher people={s.people} activeId={s.person.id} />
          </div>
        </div>
        {s.workspace.is_demo && (
          <div className="border-t border-line bg-soft px-4 py-1.5 text-center text-xs text-muted">
            Demo workspace for the fictional brand <b>{s.workspace.brand_name}</b>. Everything here is private to you and uses made-up data.
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
