import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assemblePage, DocumentError, pageAt, readPdf, stripBullets } from "./read";
import { fontFamily, isSymbolFont, looksLikeHiddenName, sameFamily } from "./fonts";
import { runCodeChecks } from "@/lib/checks";
import { proofCheck } from "@/lib/checks/proof";
import { seedContext } from "@/lib/seed/context";

const file = (p: string) => new Uint8Array(readFileSync(p));

describe("font names", () => {
  it("reduces embedded font names to their family", () => {
    expect(fontFamily("AAAAAA+Poppins-Bold")).toBe("Poppins");
    expect(fontFamily("BAAAAA+Inter-Regular")).toBe("Inter");
    expect(fontFamily("ArialMT")).toBe("Arial");
    expect(fontFamily("Arial-BoldMT")).toBe("Arial");
    expect(fontFamily("TimesNewRomanPSMT")).toBe("TimesNewRoman");
    expect(fontFamily("Times New Roman,Bold")).toBe("Times New Roman");
    expect(fontFamily("Inter_18pt-SemiBold")).toBe("Inter");
    expect(fontFamily("InterVariable")).toBe("Inter");
    expect(fontFamily("CAAAAA+Georgia")).toBe("Georgia");
  });
  it("matches a brand typeface, its cuts and nothing else", () => {
    expect(sameFamily("AAAAAA+Poppins-SemiBold", "Poppins")).toBe(true);
    expect(sameFamily("InterDisplay-Bold", "Inter")).toBe(true);
    expect(sameFamily("Interstate-Regular", "Inter")).toBe(false);
    expect(sameFamily("Georgia", "Inter")).toBe(false);
    expect(sameFamily("", "Inter")).toBe(false);
  });
  it("recognises codes written instead of font names", () => {
    for (const code of ["YAFdJt8dAY0", "TT2Ao00", "TT1A2B3Co00", "F12", "T3Font_0"]) expect(looksLikeHiddenName(code), code).toBe(true);
    for (const name of ["Poppins", "Inter", "Georgia", "TimesNewRoman", "Arial", "Helvetica", "Calibri", "NotoSansDevanagari", "Inter18"]) expect(looksLikeHiddenName(name), name).toBe(false);
  });
  it("knows icon and emoji fonts are not typefaces for words", () => {
    expect(isSymbolFont("AppleColorEmoji")).toBe(true);
    expect(isSymbolFont("ZapfDingbatsITC")).toBe(true);
    expect(isSymbolFont("FontAwesome6Free-Solid")).toBe(true);
    expect(isSymbolFont("Poppins")).toBe(false);
  });
});

describe("page text", () => {
  // pdf.js text items: transform [a, b, c, d, x, y]; size is |(c, d)|.
  const item = (str: string, x: number, y: number, size: number, font = "f1", hasEOL = false, width = str.length * size * 0.5) =>
    ({ str, fontName: font, hasEOL, transform: [size, 0, 0, size, x, y], width });
  const fonts: Record<string, string> = { f1: "AAAAAA+Inter-Regular", f2: "BAAAAA+Poppins-Bold", f3: "CAAAAA+Georgia" };

  it("joins wrapped lines of a paragraph and breaks before headings and bullets", () => {
    const { text } = assemblePage([
      item("A big heading", 50, 700, 30, "f2", true),
      item("Roasted cocoa and dates in a bar that", 50, 650, 12, "f1", true),
      item("keeps up with your day.", 50, 635, 12, "f1", true),
      item("• Order at urjabites.in.", 50, 600, 12, "f1"),
    ], (id) => fonts[id]);
    expect(text).toBe("A big heading\nRoasted cocoa and dates in a bar that keeps up with your day.\nOrder at urjabites.in.");
  });
  it("joins a word split at a hyphen across lines without a space", () => {
    const { text } = assemblePage([item("Order the 6-", 50, 650, 12, "f1", true), item("bar box today.", 50, 635, 12)], (id) => fonts[id]);
    expect(text).toBe("Order the 6-bar box today.");
  });
  it("adds a space for a visible gap on the same line", () => {
    const { text } = assemblePage([item("Price", 50, 500, 12, "f1", false, 30), item("₹540", 200, 500, 12)], (id) => fonts[id]);
    expect(text).toBe("Price ₹540");
  });
  it("keeps every run of text with its font, aligned with the text", () => {
    const { text, runs } = assemblePage([item("Gift boxes", 50, 700, 30, "f2", true), item("A box of six costs ₹540.", 50, 650, 12, "f3")], (id) => fonts[id]);
    expect(runs.map((r) => [r.font, text.slice(r.start, r.end)])).toEqual([
      ["BAAAAA+Poppins-Bold", "Gift boxes"],
      ["CAAAAA+Georgia", "A box of six costs ₹540."],
    ]);
  });
  it("removes bullet symbols at line starts without shifting the runs", () => {
    const out = stripBullets("• One\n● Two", [{ font: "a", start: 2, end: 5 }, { font: "b", start: 8, end: 11 }]);
    expect(out.text).toBe("One\nTwo");
    expect(out.runs.map((r) => out.text.slice(r.start, r.end))).toEqual(["One", "Two"]);
  });
  it("maps a position in the joined text to its page", () => {
    const pages = [{ n: 1, start: 0, end: 10 }, { n: 2, start: 12, end: 30 }, { n: 3, start: 32, end: 40 }];
    expect(pageAt(pages, 0)).toBe(1);
    expect(pageAt(pages, 11)).toBe(1); // the blank line after page 1
    expect(pageAt(pages, 12)).toBe(2);
    expect(pageAt(pages, 39)).toBe(3);
    expect(pageAt(pages, null)).toBeNull();
  });
});

describe("reading PDFs", () => {
  it("reads the sample deck page by page, with fonts and a file fingerprint", async () => {
    const doc = await readPdf(file("public/samples/urja-diwali-retail-deck.pdf"));
    expect(doc.pageCount).toBe(10);
    expect(doc.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.scanned).toBe(false);
    expect(doc.body.slice(doc.pages[2].start, doc.pages[2].end)).toContain("Our Peanut Power bar boosts immunity");
    expect(doc.pages[3].fonts.map((f) => f.family)).toContain("Georgia");
    expect(new Set(doc.pages.flatMap((p) => p.fonts.map((f) => f.family)))).toEqual(new Set(["Poppins", "Inter", "Georgia"]));
  });
  it.each([
    ["empty", "empty"], ["not-a-pdf", "not_pdf"], ["too-many-pages", "too_many_pages"], ["scanned", "no_text"], ["password", "password"], ["damaged", "damaged"],
  ])("refuses %s with a reason", async (name, code) => {
    const err = await readPdf(file(`e2e/fixtures/${name}.pdf`)).catch((e) => e);
    expect(err).toBeInstanceOf(DocumentError);
    expect(err.code).toBe(code);
    expect(err.message).not.toMatch(/undefined|\[object/);
  });
});

describe("unusual but valid PDFs", () => {
  it("reads a scan's hidden OCR text, but does not judge its fonts", async () => {
    const doc = await readPdf(file("e2e/fixtures/ocr-scan.pdf"));
    expect(doc.scanned).toBe(true);
    expect(doc.body).toContain("roasted cocoa and dates");
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, scanned: doc.scanned });
    expect(runCodeChecks(ctx).filter((f) => f.rule_code === "VIS-03")).toHaveLength(0);
  });
  it("names a standard font that is not embedded, and flags it", async () => {
    const doc = await readPdf(file("e2e/fixtures/standard-font.pdf"));
    expect(doc.scanned).toBe(false);
    const fonts = runCodeChecks(seedContext({ body: doc.body, channel: "document", pages: doc.pages })).filter((f) => f.rule_code === "VIS-03");
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({ label: "code", page: 1 });
    expect(fonts[0].message).toContain("Helvetica");
  });
  it("stops reading after the time limit", async () => {
    const err = await readPdf(file("public/samples/urja-diwali-retail-deck.pdf"), 1).catch((e) => e);
    expect(err).toBeInstanceOf(DocumentError);
    expect(err.code).toBe("too_slow");
  });
});

describe("checking a document", () => {
  it("flags fonts outside the brand typefaces once per page and font, quoting text set in it", async () => {
    const doc = await readPdf(file("public/samples/urja-diwali-retail-deck.pdf"));
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, today: "2026-11-22" });
    const fonts = runCodeChecks(ctx).filter((f) => f.rule_code === "VIS-03");
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({ page: 4, field: "document", label: "code" });
    expect(fonts[0].message).toContain("Georgia");
    expect(doc.body.slice(fonts[0].start!, fonts[0].end!)).toBe(fonts[0].quote);
  });
  it("does not check typefaces of a scan's hidden text layer", async () => {
    const doc = await readPdf(file("eval/docs/urja-store-brochure-arial.pdf"));
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, scanned: true });
    expect(runCodeChecks(ctx).filter((f) => f.rule_code === "VIS-03")).toHaveLength(0);
  });
  it("places an AI quote on the page the AI named when the words appear on several pages", () => {
    const body = "Order now at urjabites.in.\n\nOrder now at urjabites.in.";
    const pages = [{ n: 1, start: 0, end: 26, fonts: [], runs: [] }, { n: 2, start: 28, end: 54, fonts: [], runs: [] }];
    const ctx = seedContext({ body, channel: "document", pages });
    const { kept } = proofCheck([{ rule_code: "TONE-01", quote: "Order now at urjabites.in.", why: "test", page: 2 }], ctx, []);
    expect(kept[0].start).toBe(28);
  });
});
