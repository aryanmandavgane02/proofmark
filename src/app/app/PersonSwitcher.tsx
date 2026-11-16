"use client";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { switchPerson } from "@/app/actions";
import type { Person } from "@/lib/session";

const ROLE: Record<string, string> = { creator: "Creator", manager: "Brand manager", reviewer: "Authorised reviewer" };

export function PersonSwitcher({ people, activeId }: { people: Person[]; activeId: string }) {
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={switchPerson} className="flex items-center gap-2 text-sm">
      <label htmlFor="person" className="text-muted">Acting as</label>
      <input type="hidden" name="back" value={path} />
      <select
        key={activeId} // remount after a switch: React resets forms after an action, which would show the old person
        id="person"
        name="person_id"
        defaultValue={activeId}
        onChange={() => form.current?.requestSubmit()}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 font-semibold text-primary-d"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.role === "reviewer" ? p.title : ROLE[p.role]}
          </option>
        ))}
      </select>
      <noscript><button className="rounded-md border border-line px-2 py-1">Switch</button></noscript>
    </form>
  );
}
