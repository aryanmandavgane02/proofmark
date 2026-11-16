"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function PendingButton({ children, pendingText, className, disabled }: { children: ReactNode; pendingText: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={disabled || pending}>
      {pending ? pendingText : children}
    </button>
  );
}
