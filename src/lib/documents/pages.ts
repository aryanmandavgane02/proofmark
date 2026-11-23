// Where things are in a document's joined text: pages are joined with a blank line, and each page keeps its range.
import type { DocPage, FindingDraft } from "@/lib/checks/types";

export const PAGE_GAP = "\n\n";

/** The page a position in the body belongs to (pages are separated by a blank line). */
export function pageAt(pages: Pick<DocPage, "n" | "start" | "end">[], offset: number | null | undefined): number | null {
  if (offset == null || !pages.length) return null;
  for (const p of pages) if (offset < p.end + PAGE_GAP.length) return p.n;
  return pages.at(-1)!.n;
}

/** "page 4", "pages 1 and 2", "pages 1–9", "pages 2, 4 and 6–8". */
export function pageList(pages: number[]): string {
  const p = [...new Set(pages)].sort((a, b) => a - b);
  if (p.length <= 1) return p.length ? `page ${p[0]}` : "";
  const parts: string[] = [];
  for (let i = 0; i < p.length; ) {
    let j = i;
    while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++;
    if (j - i >= 2) parts.push(`${p[i]}–${p[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(p[k]));
    i = j + 1;
  }
  return `pages ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}`;
}

/** Documents: give every finding the page it is on (from its position in the joined text). */
export function withPages(findings: FindingDraft[], pages: DocPage[] | undefined): FindingDraft[] {
  if (!pages?.length) return findings;
  for (const f of findings) if (f.page == null) f.page = pageAt(pages, f.start);
  return findings;
}

/** At most this many distinct pictures per document have their words read by the AI, the largest first. */
export const MAX_PICTURES = 4;
