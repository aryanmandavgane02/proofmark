import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assemblePage, DocumentError, glyphStream, pageAt, readPdf, respace, stripBullets } from "./read";
import { fontFamily, isMonospace, isSymbolFont, looksLikeHiddenName, sameFamily } from "./fonts";
import { pageList } from "./pages";
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
  it("ends a line set in capitals: a label is not the start of the sentence below it", () => {
    const { text } = assemblePage([
      item("WOLFE'S CONDITIONS (SLIDE 29)", 50, 650, 12, "f1", true),
      item("Armijo's rule only bounds the step from above.", 50, 635, 12, "f1"),
    ], (id) => fonts[id]);
    expect(text).toBe("WOLFE'S CONDITIONS (SLIDE 29)\nArmijo's rule only bounds the step from above.");
  });
  it("keeps superscripts on their line (2³⁶, a footnote mark), but not a page number placed elsewhere", () => {
    // Positions as a PowerPoint export draws "2³⁶×2³ bytes …" (real deck, Block 2), raised space included.
    const { text } = assemblePage([
      item("2", 127.3, 320.3, 22.3, "f1", false, 12.4), item("36", 139.4, 328.4, 15.9, "f1", false, 18.5),
      item("×2", 158.8, 320.3, 22.3, "f1", false, 28.1), item("3", 186.7, 328.4, 15.9, "f1", false, 9.2),
      item(" ", 195.9, 328.4, 15.9, "f1", false, 5.9), item("bytes assuming 8-byte entries", 201.8, 320.3, 22.3, "f1", true, 300),
      item("45", 900, 40, 12),
    ], (id) => fonts[id]);
    expect(text).toBe("2³⁶×2³ bytes assuming 8-byte entries\n45");
    const footnote = assemblePage([item("Loved by 35,000+ customers", 50, 650, 14, "f1", false, 190), item("1", 240.5, 656, 9, "f1", true, 5)], (id) => fonts[id]);
    expect(footnote.text).toBe("Loved by 35,000+ customers¹");
  });
  it("joins a word split at a hyphen across lines without a space", () => {
    const { text } = assemblePage([item("Order the 6-", 50, 650, 12, "f1", true), item("bar box today.", 50, 635, 12)], (id) => fonts[id]);
    expect(text).toBe("Order the 6-bar box today.");
  });
  it("adds a space for a visible gap on the same line", () => {
    const { text } = assemblePage([item("Price", 50, 500, 12, "f1", false, 30), item("₹540", 200, 500, 12)], (id) => fonts[id]);
    expect(text).toBe("Price ₹540");
  });
  it("keeps a space between labels on one line drawn right to left", () => {
    const { text } = assemblePage([item("4096 byte", 500, 300, 12, "f1", false, 60), item("512 entries", 380, 300, 12, "f1", false, 70), item("512 entries", 260, 300, 12, "f1", false, 70)], (id) => fonts[id]);
    expect(text).toBe("4096 byte 512 entries 512 entries");
  });
  it("keeps every run of text with its font, aligned with the text", () => {
    const { text, runs } = assemblePage([item("Gift boxes", 50, 700, 30, "f2", true), item("A box of six costs ₹540.", 50, 650, 12, "f3")], (id) => fonts[id]);
    expect(runs.map((r) => [r.font, text.slice(r.start, r.end)])).toEqual([
      ["BAAAAA+Poppins-Bold", "Gift boxes"],
      ["CAAAAA+Georgia", "A box of six costs ₹540."],
    ]);
  });
  it("keeps lines of code as separate lines instead of joining them like a paragraph", () => {
    const code: Record<string, string> = { ...fonts, f4: "AAAAAJ+CourierNewPSMT" };
    const { text } = assemblePage([
      item("class Menu {", 50, 650, 12, "f4", true),
      item("static void show() {", 50, 635, 12, "f4", true),
      item("A sentence that wraps onto", 50, 600, 12, "f1", true),
      item("the next line.", 50, 585, 12, "f1"),
    ], (id) => code[id]);
    expect(text).toBe("class Menu {\nstatic void show() {\nA sentence that wraps onto the next line.");
    expect(isMonospace("JetBrainsMono-Bold")).toBe(true);
    expect(isMonospace("Monotype Corsiva")).toBe(false);
  });
  it("removes bullet symbols at line starts without shifting the runs", () => {
    const out = stripBullets("• One\n● Two", [{ font: "a", start: 2, end: 5 }, { font: "b", start: 8, end: 11 }]);
    expect(out.text).toBe("One\nTwo");
    expect(out.runs.map((r) => out.text.slice(r.start, r.end))).toEqual(["One", "Two"]);
  });
  it("names pages compactly", () => {
    expect(pageList([4])).toBe("page 4");
    expect(pageList([1, 2])).toBe("pages 1 and 2");
    expect(pageList([3, 1, 2])).toBe("pages 1–3");
    expect(pageList([2, 4, 6, 7, 8, 8])).toBe("pages 2, 4 and 6–8");
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

describe("letter-spaced text", () => {
  // pdf.js puts a space wherever letters are spread apart; the page's own glyphs say where the real spaces are.
  const OPS = { beginText: 1, endText: 2, setTextMatrix: 3, moveText: 4, nextLine: 5, setLeadingMoveText: 6, showText: 7 };
  const glyph = (u: string, isSpace = u === " ") => ({ unicode: u, isSpace });
  const item = (str: string, x: number) => ({ str, fontName: "f1", hasEOL: false, transform: [13, 0, 0, 13, x, 700], width: str.length * 6 });
  /** One showText for the whole line, as Keynote and PowerPoint draw it (numbers are kerning). */
  const oneRun = (text: string) => glyphStream([OPS.beginText, OPS.setTextMatrix, OPS.showText, OPS.endText], [[], [[13, 0, 0, 13, 0, 0]], [[...text].flatMap((c, i) => (i === 1 ? [glyph(c), -10] : [glyph(c)]))], []], OPS);
  /** One showText per letter, each followed by a move along the line, as Chrome draws it. */
  const perLetter = (text: string) => {
    const fn: number[] = [OPS.beginText, OPS.setTextMatrix];
    const args: unknown[][] = [[], [[1, 0, 0, 1, 0, 0]]];
    for (const c of text) {
      fn.push(OPS.showText, OPS.moveText);
      args.push([[glyph(c)]], [7, 0]);
    }
    return glyphStream(fn, args, OPS);
  };
  const font = () => "AAAAAA+Inter-Regular";

  it("gives words drawn with letter spacing back their real spacing (one item per word)", () => {
    const { text } = assemblePage([item("P R O G R A M M I N G", 50), item(" ", 190), item("W I T H", 200), item(" ", 250), item("J A V A", 260)], font, oneRun("PROGRAMMING WITH JAVA"));
    expect(text).toBe("PROGRAMMING WITH JAVA");
  });
  it("finds the word breaks when a whole label is one item, numbers included", () => {
    const g = perLetter("× ABOUT 19.6% DEFAULT [D2] IDLE CAPITAL");
    expect(respace("× A B O UT 1 9.6% D E FAU LT [ D2 ]", g)).toBe("× ABOUT 19.6% DEFAULT [D2]");
    expect(respace("I D L E CA PI TA L", g)).toBe("IDLE CAPITAL");
  });
  it("reads a letter whose code is the space code as a letter (some font subsets do this)", () => {
    const g = glyphStream([OPS.showText], [[[glyph("A"), glyph("M", true), glyph("P"), glyph(" "), glyph("U"), glyph("P")]]], OPS);
    expect(g.letters).toBe("AMPUP");
    expect(respace("A M P U P", g)).toBe("AMP UP");
  });
  it("joins a hyphenated heading pdf.js split (\"REAL -WORLD\") only when the page draws no space there", () => {
    expect(respace("REAL -WORLD IMPLICATIONS", perLetter("REAL-WORLD IMPLICATIONS"))).toBe("REAL-WORLD IMPLICATIONS");
    expect(respace("USE -XMX FLAG", perLetter("USE -XMX FLAG"))).toBe("USE -XMX FLAG");
    expect(respace("java -verbose App", perLetter("java -verbose App"))).toBe("java -verbose App");
  });
  it("keeps the space between two labels that are separate pieces of text", () => {
    const g = glyphStream([OPS.setTextMatrix, OPS.showText, OPS.setTextMatrix, OPS.showText], [[[1, 0, 0, 1, 0, 0]], [[glyph("A"), glyph("B")]], [[1, 0, 0, 1, 90, 0]], [[glyph("C"), glyph("D")]]], OPS);
    expect(respace("A B C D", g)).toBe("AB CD");
  });
  it("leaves text alone when the glyphs do not match or the page draws no space glyphs", () => {
    expect(respace("Q R S T", oneRun("SOMETHING ELSE"))).toBe("Q R S T");
    expect(respace("The usual words, untouched.", oneRun("The usual words, untouched."))).toBe("The usual words, untouched.");
    const noSpaces = oneRun("PROGRAMMING"); // e.g. LaTeX output, where word gaps are moves, not space glyphs
    expect(assemblePage([item("P R O G R A M M I N G", 50), item("a b c", 200)], font, noSpaces).text).toBe("P R O G R A M M I N G a b c");
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
  it("reads letter-spaced labels as words and keeps lines of code apart (a real Chrome PDF, as in real decks)", async () => {
    const doc = await readPdf(file("e2e/fixtures/letter-spacing.pdf"));
    expect(doc.body).toContain("PROBLEM MOTIVATION · PART 1");
    expect(doc.body).toContain("ABOUT 19.6% OF BOXES SOLD OUT IDLE CAPITAL");
    expect(doc.body).toContain('class Menu {\nstatic void show() {\nSystem.out.println("Showing menu");');
    expect(doc.pages[0].fonts.map((f) => f.family)).toEqual(expect.arrayContaining(["Inter", "Poppins", "CourierNew"]));
  });
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
  it("flags each font outside the brand typefaces once, quoting text set in it", async () => {
    const doc = await readPdf(file("public/samples/urja-diwali-retail-deck.pdf"));
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, today: "2026-11-22" });
    const fonts = runCodeChecks(ctx).filter((f) => f.rule_code === "VIS-03");
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({ page: 4, field: "document", label: "code" });
    expect(fonts[0].message).toContain("Georgia");
    expect(doc.body.slice(fonts[0].start!, fonts[0].end!)).toBe(fonts[0].quote);
  });
  it("names every page of a font used throughout in one finding, not one finding per page", async () => {
    const doc = await readPdf(file("eval/docs/urja-store-brochure-arial.pdf"));
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, today: "2026-11-22" });
    const fonts = runCodeChecks(ctx).filter((f) => f.rule_code === "VIS-03");
    expect(fonts).toHaveLength(1);
    expect(fonts[0].pages).toEqual([1, 2]);
    expect(fonts[0].message).toMatch(/^Pages 1 and 2 use the font Arial, which is not one of the brand's fonts \([\d,]+ letters, including this text\)\. The brand's fonts are /);
    expect(doc.body.slice(fonts[0].start!, fonts[0].end!)).toBe(fonts[0].quote);
  });
  it("counts the pictures on each page, but not icons", async () => {
    const doc = await readPdf(file("e2e/fixtures/with-pictures.pdf"));
    expect(doc.pages.map((p) => p.pictures)).toEqual([1, 0]);
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
