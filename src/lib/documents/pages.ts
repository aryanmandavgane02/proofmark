// Where things are in a document's joined text: pages are joined with a blank line, and each page keeps its range.
import type { DocPage, FindingDraft } from "@/lib/checks/types";

export const PAGE_GAP = "\n\n";

/** The page a position in the body belongs to (pages are separated by a blank line). */
export function pageAt(pages: Pick<DocPage, "n" | "start" | "end">[], offset: number | null | undefined): number | null {
  if (offset == null || !pages.length) return null;
  for (const p of pages) if (offset < p.end + PAGE_GAP.length) return p.n;
  return pages.at(-1)!.n;
}

/** Documents: give every finding the page it is on (from its position in the joined text). */
export function withPages(findings: FindingDraft[], pages: DocPage[] | undefined): FindingDraft[] {
  if (!pages?.length) return findings;
  for (const f of findings) if (f.page == null) f.page = pageAt(pages, f.start);
  return findings;
}
