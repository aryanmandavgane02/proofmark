"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Goes back to the previous page you visited inside the app; if there is none (for example a new tab), to Start here. */
export function BackLink() {
  const router = useRouter();
  const path = usePathname();
  return (
    <Link
      href="/app"
      className="text-sm text-muted hover:underline"
      onClick={(e) => {
        let prev: string | null = null;
        try {
          prev = sessionStorage.getItem("pm:prev");
        } catch {}
        if (prev && prev !== path && prev.startsWith("/app")) {
          e.preventDefault();
          router.push(prev);
        }
      }}
    >
      ← Back
    </Link>
  );
}
