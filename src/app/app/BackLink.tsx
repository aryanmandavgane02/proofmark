"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Where Back goes when there is no previous page in this tab (for example a link opened in a new tab). */
function fallback(path: string): string {
  if (/^\/app\/drafts\/[^/]+\/versions$/.test(path)) return path.replace(/\/versions$/, "");
  if (path === "/app/rulebook/import") return "/app/rulebook";
  return "/app";
}

/**
 * "← Back" on every app page except Start here: returns to the previous page visited inside the app
 * (remembered per tab by NavLinks), or to the page's parent.
 */
export function BackLink() {
  const router = useRouter();
  const path = usePathname();
  if (path === "/app") return null;
  return (
    <div className="mb-3">
      <Link
        href={fallback(path)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:-translate-x-0.5 hover:text-primary-d hover:underline"
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
    </div>
  );
}
