import "server-only";
import { redirect } from "next/navigation";

export type NoticeKind = "error" | "info" | "success";

/**
 * Ends a server action by sending the visitor back to `path` with a short message, shown as a notice
 * (src/app/app/Notices.tsx). Used instead of silently doing nothing when an action is refused,
 * for example a stale tab, the wrong person, or something already done in another tab.
 */
export function notice(path: string, message: string, kind: NoticeKind = "error"): never {
  const url = new URL(path, "http://proofmark.local");
  url.searchParams.set("notice", message.slice(0, 300));
  url.searchParams.set("kind", kind);
  redirect(`${url.pathname}${url.search}`);
}
