"use client";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { switchPerson } from "@/app/actions";
import type { Person } from "@/lib/session";

const ROLE: Record<string, string> = { creator: "Creator", manager: "Brand manager", reviewer: "Authorised reviewer" };

/** Shows the chosen person straight away, with a spinner while the server switches. */
function Picker({ people, activeId, onPick, describedBy }: { people: Person[]; activeId: string; onPick: () => void; describedBy?: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="relative inline-flex items-center">
      <select
        key={activeId} // remount after a switch: React resets forms after an action, which would show the old person
        id="person"
        name="person_id"
        defaultValue={activeId}
        onChange={onPick}
        aria-busy={pending}
        aria-describedby={describedBy}
        className={`rounded-lg border border-line bg-surface py-1.5 pl-2 pr-8 font-semibold text-primary-d shadow-card transition ${pending ? "opacity-70" : ""}`}
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.role === "reviewer" ? p.title : ROLE[p.role]}
          </option>
        ))}
      </select>
      {pending && (
        <span role="status" className="absolute -bottom-5 right-0 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-violet">
          <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-violet/30 border-t-violet" />
          Switching…
        </span>
      )}
    </span>
  );
}

export function PersonSwitcher({ people, activeId, describedBy }: { people: Person[]; activeId: string; describedBy?: string }) {
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={switchPerson} className="flex items-center gap-2 text-sm">
      <label htmlFor="person" className="text-muted">Acting as</label>
      <input type="hidden" name="back" value={path} />
      <Picker people={people} activeId={activeId} onPick={() => form.current?.requestSubmit()} describedBy={describedBy} />
      <noscript><button className="rounded-md border border-line px-2 py-1">Switch</button></noscript>
    </form>
  );
}
