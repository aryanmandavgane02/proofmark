// Small text helpers shared by the code checks.

export type Span = { text: string; start: number; end: number };

/**
 * Splits text into sentences, keeping exact positions. Line breaks also end a sentence. A full stop inside a word or
 * a number ("urjabites.in", "4.6") does not: a sentence ends at . ! or ? followed by a space, a line break or the end.
 */
export function sentences(text: string): Span[] {
  const out: Span[] = [];
  const re = /(?:[^.!?\n]|[.!?](?=[^\s.!?]))+(?:[.!?]+|(?=\n)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const start = m.index + lead;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

export function sentenceAt(text: string, index: number): Span | undefined {
  return sentences(text).find((s) => index >= s.start && index < s.end);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** All matches of a phrase as a whole word or words. */
export function findPhrase(text: string, phrase: string, caseSensitive = false): Span[] {
  const re = new RegExp(`(?<![\\p{L}\\p{N}#@])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, caseSensitive ? "gu" : "giu");
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function capitaliseLike(source: string, replacement: string): string {
  if (!replacement) return replacement;
  if (/^[A-Z]/.test(source) && /^[a-z]/.test(replacement)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function formatIndian(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function overlaps(a: { start: number | null; end: number | null }, b: { start: number | null; end: number | null }): boolean {
  if (a.start == null || a.end == null || b.start == null || b.end == null) return false;
  return a.start < b.end && b.start < a.end;
}
