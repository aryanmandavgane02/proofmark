// Reads a PDF into what the checks need: the text of every page joined into one body with a page map, which font
// sets each run of text, and a fingerprint of the exact file. Refuses anything it cannot check, with the reason.
// Uses pdf.js (through unpdf) only: no network and no storage, so it runs the same in the app, the tests and the eval.
import { createHash } from "node:crypto";
import { getDocumentProxy, getResolvedPDFJS, inspectPages } from "unpdf";
import type { DocPage } from "@/lib/checks/types";
import { fontFamily, isMonospace } from "./fonts";
import { PAGE_GAP } from "./pages";

export { pageAt, withPages } from "./pages";

export const MAX_PAGES = 100;
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_CHARS = 60_000;
/** Reading stops after this long, so a damaged or hostile file cannot hold the server. */
export const READ_TIMEOUT_MS = 20_000;

export type ReadDocument = { body: string; pages: DocPage[]; pageCount: number; hash: string; size: number; scanned: boolean };

export type DocumentErrorCode = "empty" | "not_pdf" | "too_large" | "password" | "damaged" | "too_many_pages" | "no_text" | "too_much_text" | "too_slow";
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

/**
 * What a page really draws, in drawing order: its letters, and before each letter whether the PDF drew a space (1) or
 * started a new piece of text (2). pdf.js puts a space wherever letters are spread apart, so letter-spaced words
 * ("P R O G R A M") come out in pieces; these glyphs give them back their real spacing.
 */
export type Glyphs = { letters: string; mark: number[]; spaces: number; at: number };

type Ops = Record<string, number>;

/** Smallest picture counted, in pixels of the image itself: smaller ones are icons, bullets and dividers. */
const MIN_PICTURE_PIXELS = 64 * 64;

/**
 * Pictures a page draws (photos, logos, charts saved as images), from its pdf.js operator list. Proofmark checks the
 * text, fonts and claims of every page, not what is inside a picture, so the document says which pages have them.
 */
export function countPictures(fnArray: number[], argsArray: unknown[][], OPS: Ops): number {
  let n = 0;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const [, w, h] = argsArray[i] as [unknown, number?, number?];
      if (!w || !h || w * h >= MIN_PICTURE_PIXELS) n++;
    } else if (fn === OPS.paintInlineImageXObject) {
      const img = argsArray[i]?.[0] as { width?: number; height?: number } | undefined;
      if ((img?.width ?? 0) * (img?.height ?? 0) >= MIN_PICTURE_PIXELS) n++;
    }
  }
  return n;
}

/** Builds a page's Glyphs from its pdf.js operator list. */
export function glyphStream(fnArray: number[], argsArray: unknown[][], OPS: Ops): Glyphs {
  let letters = "";
  const mark: number[] = [];
  let pending = 0;
  let spaces = 0;
  const breaks = new Set([OPS.beginText, OPS.endText, OPS.setTextMatrix, OPS.nextLine, OPS.setLeadingMoveText]);
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    if (fn === OPS.showText) {
      for (const g of (argsArray[i]?.[0] ?? []) as unknown[]) {
        if (!g || typeof g !== "object") continue; // numbers are kerning
        const u = clean(String((g as { unicode?: unknown }).unicode ?? ""));
        if (!u) continue;
        if (/^\s+$/.test(u)) {
          pending = 1; // the glyph's text, not its code: some subset fonts give letters the space code 32
          spaces++;
          continue;
        }
        for (let c = 0; c < u.length; c++) mark.push(c === 0 ? pending : 0);
        letters += u;
        pending = 0;
      }
    } else if (breaks.has(fn) || (fn === OPS.moveText && Number((argsArray[i] as number[])?.[1] ?? 0) !== 0)) {
      if (!pending) pending = 2; // a move along the same line (dy = 0) is just the next letter
    }
  }
  return { letters, mark, spaces, at: 0 };
}

/** The real spacing of a letter-spaced piece ("I D L E CA PI TA L" → "IDLE CAPITAL"), or null when the glyphs disagree. */
function fromGlyphs(tokens: string[], g: Glyphs): string | null {
  const letters = tokens.join("");
  let at = g.letters.indexOf(letters, g.at);
  if (at < 0) at = g.letters.indexOf(letters);
  if (at < 0) return null;
  g.at = at + letters.length;
  const gaps = new Set<number>(); // where the item itself had a space
  let n = 0;
  for (const t of tokens) {
    if (n) gaps.add(n);
    n += t.length;
  }
  let out = "";
  for (let k = 0; k < letters.length; k++) {
    const m = g.mark[at + k];
    if (k && (m === 1 || (m === 2 && gaps.has(k)))) out += " ";
    out += letters[k];
  }
  return out;
}

/**
 * Gives letter-spaced words in one text item back their real spacing. Only pieces that look letter-spaced (three or
 * more short pieces, at least half of them single letters, or two single letters) are touched, and only when the page's
 * glyphs match them.
 */
export function respace(str: string, g: Glyphs | undefined): string {
  if (!g?.letters || !str.includes(" ")) return str;
  const tokens = str.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let j = i;
    while (j < tokens.length && tokens[j].length > 0 && tokens[j].length <= 4) j++;
    const piece = tokens.slice(i, j);
    const singles = piece.filter((t) => [...t].length === 1).length;
    if ((piece.length >= 3 && singles * 2 >= piece.length) || (piece.length === 2 && singles === 2)) {
      // An icon or bullet drawn elsewhere can sit at either end, so try without it too.
      const tries: [number, number][] = [[0, piece.length], [1, piece.length], [0, piece.length - 1], [1, piece.length - 1]];
      let fixed: string | null = null;
      for (const [a, b] of tries) {
        if (b - a < Math.min(3, piece.length)) continue;
        const inner = fromGlyphs(piece.slice(a, b), g);
        if (inner != null) {
          fixed = [...piece.slice(0, a), inner, ...piece.slice(b)].join(" ");
          break;
        }
      }
      out.push(fixed ?? piece.join(" "));
      i = j;
    } else if (/\p{Lu}{2,}$/u.test(tokens[i]) && /^-\p{Lu}{2,}/u.test(tokens[i + 1] ?? "")) {
      // A letter-spaced heading with a hyphen: pdf.js reads "REAL -WORLD". Joined only when the page draws no real
      // space there, so command-line flags and minus signs ("java -verbose", "or -1") keep theirs.
      const joined = fromGlyphs([tokens[i], tokens[i + 1]], g);
      out.push(joined ?? `${tokens[i]} ${tokens[i + 1]}`);
      i += 2;
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  return out.join(" ");
}

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

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "(": "⁽", ")": "⁾",
};

/**
 * A superscript: one to four digits or signs, in a smaller font, raised above the text just before it, and starting
 * where that text ends ("2" then "36" is 2³⁶; "customers" then "1" is a footnote mark). Page numbers and diagram labels
 * sit elsewhere on the page, so they stay separate lines. (Real decks, Round 3, Block 2.)
 */
export function isSuperscript(str: string, at: { x: number; y: number; size: number }, last: { y: number; size: number; xEnd: number }): boolean {
  const raised = at.y - last.y;
  return /^[0-9+\-−()]{1,4}$/.test(str) && at.size <= last.size * 0.8 && raised > last.size * 0.15 && raised < last.size * 0.8 && Math.abs(at.x - last.xEnd) < last.size * 0.6;
}

/** The page's text with line breaks where a reader would see them, and the font of each run. */
export function assemblePage(items: Item[], fontOf: (id: string) => string, glyphs?: Glyphs): { text: string; runs: Run[] } {
  let text = "";
  let runs: Run[] = [];
  let last: { x: number; y: number; size: number; xEnd: number; font: string } | null = null;
  let pendingBreak = false;
  let afterSup = false;
  // Letter spacing is repaired only on pages that draw real space glyphs (not, for example, LaTeX output).
  const itemSpaces = items.reduce((n, it) => n + (typeof it.str === "string" ? it.str.split(" ").length - 1 : 0), 0);
  const g = glyphs && glyphs.spaces >= Math.max(1, itemSpaces * 0.1) ? glyphs : undefined;
  for (const it of items) {
    if (typeof it.str !== "string" || it.dir === "ttb") continue;
    const str = respace(clean(it.str), g);
    if (str.length && afterSup && last && !str.trim()) {
      // A space drawn at the superscript's height is the gap before the next word, not a new line.
      if (!/\s$/.test(text)) text += " ";
      last = { x: last.x, y: last.y, size: last.size, font: last.font, xEnd: it.transform[4] + (it.width || 0) };
    } else if (str.length) {
      const [, , c, d, x, y] = it.transform;
      const size = Math.hypot(c, d) || 1;
      const font = fontOf(it.fontName);
      // A small number raised right after the text before it is a superscript ("2³⁶", "customers¹"): it stays on that line.
      const sup: boolean = !!last && text.length > 0 && isSuperscript(str, { x, y, size }, last);
      // The text after a superscript, back on the main line, continues it (pdf.js marks a line end at the raised part).
      const backOnLine = !!last && afterSup && Math.abs(y - last.y) < last.size * 0.15 && Math.abs(x - last.xEnd) < last.size * 0.6;
      if (last && text.length && !sup) {
        const sameLine = Math.abs(y - last.y) < size * 0.5;
        if ((pendingBreak && !backOnLine) || !sameLine) {
          // A wrapped line of the same paragraph joins with a space; a new paragraph, a heading or a bullet starts a new line.
          const similar = Math.abs(size - last.size) <= Math.max(last.size, size) * 0.15;
          const close = Math.abs(last.y - y) <= Math.max(last.size, size) * 1.75;
          // Lines of code or program output (in a fixed-width font) stay separate lines, and so does a label or heading
          // set in capitals: it is not the first half of the sentence below it.
          const line = text.slice(text.lastIndexOf("\n") + 1);
          const capsLine = (line.match(/\p{L}/gu) ?? []).length >= 4 && line === line.toUpperCase();
          const soft = similar && close && y < last.y && !BULLET.test(str) && !isMonospace(font) && !isMonospace(last.font) && !capsLine;
          text = text.replace(/[ \t]+$/, "");
          // A word split at a hyphen ("6-" / "bar box") joins back without a space: "6-bar box".
          text += soft ? (/[\p{L}\p{N}]-$/u.test(text) ? "" : " ") : "\n";
        } else if (!/\s$/.test(text) && !/^\s/.test(str) && (x - last.xEnd > size * 0.25 || x < last.x - size * 0.25)) {
          text += " "; // a visible gap on the same line (table cells), or a label drawn to the left of the last one
        }
      }
      const start = text.length;
      text += sup ? [...str].map((ch) => SUPERSCRIPT[ch] ?? ch).join("") : str;
      const prev = runs.at(-1);
      if (prev && prev.font === font && /^\s*$/.test(text.slice(prev.end, start))) prev.end = text.length;
      else runs.push({ font, start, end: text.length });
      // After a superscript the main line is still the reference for what follows.
      last = sup ? { ...last!, xEnd: x + (it.width || 0) } : { x, y, size, xEnd: x + (it.width || 0), font };
      afterSup = sup;
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


/** Reads and validates a PDF. Throws DocumentError with a plain reason when it cannot be checked. */
export async function readPdf(bytes: Uint8Array, timeoutMs = READ_TIMEOUT_MS): Promise<ReadDocument> {
  const open: { pdf?: Awaited<ReturnType<typeof getDocumentProxy>> } = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      open.pdf?.loadingTask.destroy().catch(() => {}); // stop pdf.js working on it
      reject(new DocumentError("This PDF took too long to read. Export it again from the original file, or upload fewer pages.", "too_slow"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([read(bytes, open), late]);
  } finally {
    clearTimeout(timer);
  }
}

async function read(bytes: Uint8Array, open: { pdf?: Awaited<ReturnType<typeof getDocumentProxy>> }): Promise<ReadDocument> {
  if (!bytes.length) throw new DocumentError("The file is empty.", "empty");
  if (bytes.length > MAX_BYTES) throw new DocumentError(`The file is ${(bytes.length / 1048576).toFixed(1)} MB. Upload a PDF of 15 MB or less.`, "too_large");
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!head.includes("%PDF-")) throw new DocumentError("This file is not a PDF. Export the document or deck as PDF and upload that.", "not_pdf");
  const hash = createHash("sha256").update(bytes).digest("hex");

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(bytes.slice(), { fontExtraProperties: true, stopAtErrors: false, verbosity: 0 });
    open.pdf = pdf;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new DocumentError("This PDF is protected with a password. Remove the password, export it again and upload the new file.", "password");
    throw new DocumentError("This PDF could not be read; it may be damaged. Export it again from the original file and upload the new copy.", "damaged");
  }
  try {
    const pageCount = pdf.numPages;
    if (!pageCount) throw new DocumentError("This PDF has no pages.", "damaged");
    if (pageCount > MAX_PAGES) throw new DocumentError(`This PDF has ${pageCount} pages. Proofmark checks documents of up to ${MAX_PAGES} pages: split it, or upload the pages that matter.`, "too_many_pages");

    const { OPS } = await getResolvedPDFJS();
    const raw: { text: string; runs: Run[]; pictures: number }[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const page = await pdf.getPage(n);
      const ops = await page.getOperatorList(); // also loads the page's fonts, so their real names are known
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
      raw.push({
        ...assemblePage(content.items as Item[], fontOf, glyphStream(ops.fnArray, ops.argsArray as unknown[][], OPS as unknown as Ops)),
        pictures: countPictures(ops.fnArray, ops.argsArray as unknown[][], OPS as unknown as Ops),
      });
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
      return { n: i + 1, start, end: body.length, fonts: [...fonts.values()].sort((a, b) => b.chars - a.chars), runs: runs.map(({ family, start, end }) => ({ family, start, end })), pictures: p.pictures };
    });

    const letters = (body.match(/[\p{L}\p{N}]/gu) ?? []).length;
    if (letters < 3) throw new DocumentError("This PDF has no text that can be selected; it looks like scanned pages or pictures. Export it from the original file (Google Slides, Canva, PowerPoint or Word) so the words can be checked.", "no_text");
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
