// Verifies rules drafted by AI from a brand-guide PDF before a person sees them:
// the quote must exist in the document (its page is corrected if the AI got it wrong),
// and rules already in the rulebook are not imported twice.
import { locateQuote, type Dropped } from "./proof";
import type { Category, Severity } from "./types";

export type DraftedRule = { category: Category; title: string; statement: string; severity: Severity; source_quote: string; source_page: number };
export type VerifiedRule = DraftedRule & { code: string; page_corrected: boolean };

const CATS: Category[] = ["tone", "terminology", "messaging", "visual", "accessibility", "claims"];
const PREFIX: Record<Category, string> = { tone: "TONE", terminology: "TERM", messaging: "MSG", visual: "VIS", accessibility: "A11Y", claims: "CLAIM" };
const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export function verifyImportedRules(drafted: DraftedRule[], pages: string[], existing: { code: string; source_quote: string }[]): { rules: VerifiedRule[]; dropped: Dropped[] } {
  const rules: VerifiedRule[] = [];
  const dropped: Dropped[] = [];
  const used = new Set(existing.map((r) => r.code));
  const nextCode = (cat: Category) => {
    for (let n = 1; ; n++) {
      const code = `${PREFIX[cat]}-${String(n).padStart(2, "0")}`;
      if (!used.has(code)) {
        used.add(code);
        return code;
      }
    }
  };
  for (const d of drafted) {
    const quote = (d.source_quote ?? "").trim();
    if (!CATS.includes(d.category) || !["blocker", "major", "minor"].includes(d.severity) || !d.statement?.trim()) {
      dropped.push({ rule_code: d.title ?? "?", quote, reason: "is incomplete (category, severity or rule text missing)" });
      continue;
    }
    if (quote.length < 12) {
      dropped.push({ rule_code: d.title, quote, reason: "has no usable quote from the document" });
      continue;
    }
    let page = Number(d.source_page);
    let corrected = false;
    if (!(page >= 1 && page <= pages.length && locateQuote(pages[page - 1], quote))) {
      const found = pages.findIndex((t) => locateQuote(t, quote));
      if (found < 0) {
        dropped.push({ rule_code: d.title, quote, reason: "quotes text that is not in the document" });
        continue;
      }
      page = found + 1;
      corrected = true;
    }
    const exact = locateQuote(pages[page - 1], quote)!;
    const exactQuote = pages[page - 1].slice(exact.start, exact.end).replace(/\s+/g, " ");
    const dup = [...existing, ...rules].filter((r) => norm(r.source_quote ?? "").length >= 12).find((r) => norm(r.source_quote).includes(norm(exactQuote)) || norm(exactQuote).includes(norm(r.source_quote)));
    if (dup) {
      dropped.push({ rule_code: d.title, quote, reason: `is already in the rulebook as ${dup.code}` });
      continue;
    }
    rules.push({ ...d, statement: d.statement.trim(), title: d.title.trim().slice(0, 80), source_quote: exactQuote, source_page: page, code: nextCode(d.category), page_corrected: corrected });
  }
  return { rules, dropped };
}
