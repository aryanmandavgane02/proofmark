"use client";
import type { ReactNode } from "react";

/** Closes the surrounding <details> panel (used as "Cancel" on confirmations). */
export function CloseDetails({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
      {children}
    </button>
  );
}
