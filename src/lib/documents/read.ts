// Reads a PDF into what the checks need: the text of every page joined into one body with a page map, which font
// sets each run of text, and a fingerprint of the exact file. Refuses anything it cannot check, with the reason.
// Uses pdf.js (through unpdf) only: no network and no storage, so it runs the same in the app, the tests and the eval.
import { createHash } from "node:crypto";
import { getDocumentProxy, inspectPages } from "unpdf";
import type { DocPage, FindingDraft } from "@/lib/checks/types";
import { fontFamily } from "./fonts";

export const MAX_PAGES = 20;
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_CHARS = 60_000;

export type ReadDocument = { body: string; pages: DocPage[]; pageCount: number; hash: string; size: number; scanned: boolean };

export type DocumentErrorCode = "empty" | "not_pdf" | "too_large" | "password" | "damaged" | "too_many_pages" | "no_text" | "too_much_text";
export class DocumentError extends Error {
  constructor(message: string, readonly code: DocumentErrorCode) {
    super(message);
  }
}

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };
const clean = (s: string) => s.replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c).replace(/­/g, "").replace(/\u0000/g, "");
const BULLET = /^\s*(?:[•◦▪▫●○■□►▶–—*·-](?:\s|$)|\d{1,2}[.)](?:\s|$))/;

type Item = { str: string; fontName: string; hasEOL: boolean; transform: number[]; width: number; dir?: string };
type Run = { font: string; start: number; end: number };

/** Removes bullet symbols at the start of lines (they are layout, not words), keeping the runs aligned. */
export function stripBullets(text: string, runs: Run[]): { text: string; runs: Run[] } {
  const cuts: [number, number][] = [];
  for (const m of text.matchAll(/(^|\n)([•◦▪▫●○■□►▶][ \t]*)/g)) {
    const s = m.index! + m[1].length;
    cuts.push([s, s + m[2].length]);
  }
  if (!cuts.length) return { text, runs };
  const map = (o: number) => o - cuts.reduce((n, [s, e]) => n + (o >= e ? e - s : o > s ? o - s : 0), 0);
  let out = "";
  let at = 0;
  for (const [s, e] of cuts) {
    out += text.slice(at, s);
    at = e;
  }
  out += text.slice(at);
  return { text: out, runs: runs.map((r) => ({ ...r, start: map(r.start), end: map(r.end) })).filter((r) => r.end > r.start) };
}

/** The page's text with line breaks where a reader would see them, and the font of each run. */
export function assemblePage(items: Item[], fontOf: (id: string) => string): { text: string; runs: Run[] } {
  let text = "";
  let runs: Run[] = [];
  let last: { y: number; size: number; xEnd: number } | null = null;
  let pendingBreak = false;
  for (const it of items) {
    if (typeof it.str !== "string" || it.dir === "ttb") continue;
    const str = clean(it.str);
    if (str.length) {
      const [, , c, d, x, y] = it.transform;
      const size = Math.hypot(c, d) || 1;
      if (last && text.length) {
        const sameLine = Math.abs(y - last.y) < size * 0.5;
        if (pendingBreak || !sameLine) {
          // A wrapped line of the same paragraph joins with a space; a new paragraph, a heading or a bullet starts a new line.
          const similar = Math.abs(size - last.size) <= Math.max(last.size, size) * 0.15;
          const close = Math.abs(last.y - y) <= Math.max(last.size, size) * 1.75;
          const soft = similar && close && y < last.y && !BULLET.test(str);
          text = text.replace(/[ \t]+$/, "");
          text += soft ? " " : "\n";
        } else if (!/\s$/.test(text) && !/^\s/.test(str) && x - last.xEnd > size * 0.25) {
          text += " "; // a visible gap on the same line (for example table cells)
        }
      }
      const start = text.length;
      text += str;
      const font = fontOf(it.fontName);
      const prev = runs.at(-1);
      if (prev && prev.font === font && /^\s*$/.test(text.slice(prev.end, start))) prev.end = text.length;
      else runs.push({ font, start, end: text.length });
      last = { y, size, xEnd: x + (it.width || 0) };
      pendingBreak = false;
    }
    if (it.hasEOL) pendingBreak = true;
  }
  ({ text, runs } = stripBullets(text, runs));
  // Trim the ends and keep the runs aligned with the trimmed text.
  const lead = text.length - text.trimStart().length;
  const trimmed = text.trim();
  return {
    text: trimmed,
    runs: runs
      .map((r) => ({ font: r.font, start: Math.max(0, r.start - lead), end: Math.min(trimmed.length, r.end - lead) }))
      .filter((r) => r.end > r.start && /[\p{L}\p{N}]/u.test(trimmed.slice(r.start, r.end))),
  };
}

const PAGE_GAP = "\n\n";

/** Reads and validates a PDF. Throws DocumentError with a plain reason when it cannot be checked. */
export async function readPdf(bytes: Uint8Array): Promise<ReadDocument> {
  if (!bytes.length) throw new DocumentError("The file is empty.", "empty");
  if (bytes.length > MAX_BYTES) throw new DocumentError(`The file is ${(bytes.length / 1048576).toFixed(1)} MB. Upload a PDF of 15 MB or less.`, "too_large");
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!head.includes("%PDF-")) throw new DocumentError("This file is not a PDF. Export the document or deck as PDF and upload that.", "not_pdf");
  const hash = createHash("sha256").update(bytes).digest("hex");

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(bytes.slice(), { fontExtraProperties: true, stopAtErrors: false, verbosity: 0 });
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new DocumentError("This PDF is protected with a password. Remove the password, export it again and upload the new file.", "password");
    throw new DocumentError("This PDF could not be read; it may be damaged. Export it again from the original file and upload the new copy.", "damaged");
  }
  try {
    const pageCount = pdf.numPages;
    if (!pageCount) throw new DocumentError("This PDF has no pages.", "damaged");
    if (pageCount > MAX_PAGES) throw new DocumentError(`This PDF has ${pageCount} pages. Proofmark checks documents of up to ${MAX_PAGES} pages: split it, or upload the pages that matter.`, "too_many_pages");

    const raw: { text: string; runs: Run[] }[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const page = await pdf.getPage(n);
      await page.getOperatorList(); // loads the page's fonts, so their real names are known
      const content = await page.getTextContent();
      const names = new Map<string, string>();
      const fontOf = (id: string) => {
        if (!names.has(id)) {
          let name = "";
          try {
            name = String((page.commonObjs.get(id) as { name?: string } | undefined)?.name ?? "");
          } catch {
            name = "";
          }
          names.set(id, name);
        }
        return names.get(id)!;
      };
      raw.push(assemblePage(content.items as Item[], fontOf));
      page.cleanup();
    }

    // Join the pages with a page map, so every existing check runs on one text and each finding knows its page.
    let body = "";
    const pages: DocPage[] = raw.map((p, i) => {
      if (i > 0) body += PAGE_GAP;
      const start = body.length;
      body += p.text;
      const runs = p.runs.map((r) => ({ family: r.font ? fontFamily(r.font) : "", font: r.font, start: start + r.start, end: start + r.end }));
      const fonts = new Map<string, { family: string; font: string; chars: number }>();
      for (const r of runs) {
        const letters = (body.slice(r.start, r.end).match(/[\p{L}\p{N}]/gu) ?? []).length;
        const k = r.family || "(unnamed font)";
        const f = fonts.get(k) ?? { family: k, font: r.font, chars: 0 };
        f.chars += letters;
        fonts.set(k, f);
      }
      return { n: i + 1, start, end: body.length, fonts: [...fonts.values()].sort((a, b) => b.chars - a.chars), runs: runs.map(({ family, start, end }) => ({ family, start, end })) };
    });

    const letters = (body.match(/[\p{L}\p{N}]/gu) ?? []).length;
    if (letters < 20) throw new DocumentError("This PDF has no text that can be selected; it looks like scanned pages or pictures. Export it from the original file (Google Slides, Canva, PowerPoint or Word) so the words can be checked.", "no_text");
    if (body.length > MAX_CHARS) throw new DocumentError(`This PDF has about ${Math.round(body.length / 1000)},000 characters of text. Proofmark checks up to ${MAX_CHARS / 1000},000: upload the pages that matter.`, "too_much_text");

    // Scans with an invisible OCR layer have text, but its fonts say nothing about the design.
    let scanned = false;
    try {
      const inspected = await inspectPages(pdf);
      const all = inspected.pages.reduce((s, p) => s + p.textLength, 0);
      const hidden = inspected.pages.reduce((s, p) => s + p.invisibleTextLength, 0);
      scanned = all > 0 && hidden / all >= 0.6;
    } catch {
      scanned = false;
    }
    return { body, pages, pageCount, hash, size: bytes.length, scanned };
  } finally {
    await pdf.loadingTask.destroy().catch(() => {});
  }
}

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
