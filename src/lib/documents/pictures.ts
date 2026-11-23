// Pictures inside a PDF, for the AI to read the words in them (Round 3, Block 2). A "50% OFF" or "#1" baked into a
// slide's image is a claim like any other, but the text layer does not have it. Only the largest pictures are read:
// decks exported from Canva can hold a hundred images, some of them whole slides, and each one read is an AI request.
import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { extractImages, getDocumentProxy } from "unpdf";
import type { DocPage } from "@/lib/checks/types";

import { MAX_PICTURES } from "./pages";

export { MAX_PICTURES };
/** Smaller pictures are icons, bullets and thin dividers, which rarely carry a claim. */
const MIN_WIDTH = 150;
const MIN_HEIGHT = 60;
/** Reading pictures stops after this long, keeping what was found: the AI step has its own time budget. */
const EXTRACT_MS = 8_000;

export type DeckPicture = { pages: number[]; hash: string; mimeType: "image/jpeg"; data: string; width: number; height: number };

type Raw = { pages: number[]; width: number; height: number; data: Uint8Array | Uint8ClampedArray };

/** The largest distinct pictures of the pages that have any, each as a JPEG of at most 1024 pixels, with its pages. */
export async function deckPictures(bytes: Uint8Array, pages: DocPage[]): Promise<{ pictures: DeckPicture[]; found: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const started = Date.now();
  const kept: (Raw & { hash: string })[] = [];
  const pagesOf = new Map<string, number[]>();
  try {
    for (const page of pages) {
      if (!page.pictures || Date.now() - started > EXTRACT_MS) continue;
      let images: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }[] = [];
      try {
        images = await extractImages(pdf, page.n);
      } catch {
        continue; // a picture pdf.js cannot decode is skipped, not fatal
      }
      for (const im of images) {
        if (im.width < MIN_WIDTH || im.height < MIN_HEIGHT) continue;
        const hash = createHash("sha256").update(im.data).digest("hex");
        const seen = pagesOf.get(hash);
        if (seen) {
          if (!seen.includes(page.n)) seen.push(page.n);
          continue;
        }
        const on = [page.n];
        pagesOf.set(hash, on);
        // Keep only the largest few in memory: a page-sized picture is tens of megabytes once decoded.
        kept.push({ hash, pages: on, width: im.width, height: im.height, data: im.data });
        kept.sort((a, b) => b.width * b.height - a.width * a.height);
        if (kept.length > MAX_PICTURES) kept.pop();
      }
    }
    const pictures: DeckPicture[] = [];
    for (const k of kept) {
      const channels = Math.round(k.data.length / (k.width * k.height));
      if (![1, 2, 3, 4].includes(channels)) continue;
      const jpeg = await sharp(Buffer.from(k.data.buffer, k.data.byteOffset, k.data.byteLength), { raw: { width: k.width, height: k.height, channels: channels as 1 | 2 | 3 | 4 } })
        .flatten({ background: "#ffffff" })
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      pictures.push({ pages: [...k.pages].sort((a, b) => a - b), hash: k.hash, mimeType: "image/jpeg", data: jpeg.toString("base64"), width: k.width, height: k.height });
    }
    return { pictures, found: pagesOf.size };
  } finally {
    await pdf.loadingTask.destroy().catch(() => {});
  }
}
