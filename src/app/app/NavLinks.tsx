"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconBook, IconChart, IconFact, IconFlag, IconInbox, IconPen, IconShield, IconTrail } from "@/components/icons";

const NAV = [
  { href: "/app", label: "Start here", Icon: IconFlag },
  { href: "/app/drafts/new", label: "New draft", Icon: IconPen },
  { href: "/app/review", label: "Review", Icon: IconInbox },
  { href: "/app/insights", label: "Insights", Icon: IconChart },
  { href: "/app/rulebook", label: "Rulebook", Icon: IconBook },
  { href: "/app/facts", label: "Facts", Icon: IconFact },
  { href: "/app/activity", label: "Audit trail", Icon: IconTrail },
  { href: "/app/ai", label: "AI & data", Icon: IconShield },
];

/** Main navigation; the current section is highlighted and announced to screen readers. */
export function NavLinks() {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Remember the previous page inside the app, for the "Back" link on drafts (per tab, never sent anywhere).
  useEffect(() => {
    try {
      const current = sessionStorage.getItem("pm:current");
      if (current && current !== path) sessionStorage.setItem("pm:prev", current);
      sessionStorage.setItem("pm:current", path);
    } catch {}
  }, [path]);
  // On a phone the links scroll sideways: bring the current one into view.
  useEffect(() => {
    const nav = ref.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && current && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = current.offsetLeft - nav.clientWidth / 2 + current.offsetWidth / 2;
  }, [path]);
  const active = (href: string) =>
    href === "/app" ? path === "/app" : href === "/app/drafts/new" ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <nav ref={ref} className="-mx-4 flex gap-0.5 overflow-x-auto px-4 text-sm [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]" aria-label="Main">
      {NAV.map(({ href, label, Icon }) => {
        const on = active(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition ${
              on ? "bg-primary-d text-white shadow-[0_4px_12px_-4px_rgb(31_42_107/0.5)]" : "text-muted hover:bg-soft hover:text-primary-d"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
