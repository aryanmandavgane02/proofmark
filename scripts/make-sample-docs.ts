// Builds the sample PDF documents with headless Chrome and Google Fonts (Poppins and Inter, the brand typefaces), then
// reads every file back with the app's own PDF reader to prove the text, pages and fonts come out as intended.
//   public/samples/urja-diwali-retail-deck.pdf    10-page deck for store partners, with problems planted on known pages
//   public/samples/urja-diwali-retail-deck-corrected.pdf  the same deck with every problem fixed (the next version);
//                                                  its text and pages also go to src/lib/seed/library-deck.json
//   public/samples/urja-cocoa-crunch-one-pager.pdf one clean page (a control: nothing should be flagged)
//   eval/docs/urja-store-brochure-arial.pdf        2 pages set in Arial, for the scored test set
//   e2e/fixtures/*.pdf                             files the upload must refuse, each for one reason, and two odd
//                                                  but valid files: an OCR-style scan and a standard, unembedded font
// Usage: npx tsx scripts/make-sample-docs.ts   (needs Google Chrome and a network connection for the fonts)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DocumentError, readPdf } from "../src/lib/documents/read";
import { URJA_LOGO_PNG_BASE64 } from "../src/lib/seed/logo-png";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;600&display=block" rel="stylesheet">';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function print(html: string, out: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "docs-"));
  const src = path.join(dir, "doc.html");
  writeFileSync(src, html);
  mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000", `--user-data-dir=${dir}/p`, `--print-to-pdf=${out}`, `file://${src}`], { stdio: "ignore" });
}

// ── The Diwali retail deck ───────────────────────────────────────────────────
// Planted problems (the scored test set lists them in eval/cases.ts, written before any run):
//   p2 CLAIM-01 50,000+ customers (fact F-12 says 35,000+)   p3 CLAIM-03 "boosts immunity"
//   p4 VIS-03 body text in Georgia                           p5 CLAIM-02 "India's #1 protein bar"
//   p6 DISC-01 an offer and no "T&C apply" anywhere          p7 TERM-01 "guilt-free"
//   p8 TONE-04 "Hurry … ends soon" and TONE-03 capitals      p9 TONE-01 a preachy line (only AI can judge it)
// Pages 1 and 10 are clean.
type Slide = { title: string; lines: string[]; cover?: boolean; bodyFont?: string };
const DECK: Slide[] = [
  { cover: true, title: "Roasted cocoa, dates and Diwali cheer", lines: ["Urja Bites for Diwali 2026: a retail partner deck for stores in Bengaluru, Pune and Mumbai."] },
  { title: "Why shoppers come back", lines: ["Roasted cocoa, peanuts and dates you can taste in every bite.", "Each bar has 12 g of protein and no added sugar.", "Loved by 50,000+ customers in Bengaluru, Pune and Mumbai.", "Rated 4.6 out of 5 by 1,200 buyers on urjabites.in."] },
  { title: "This season's flavours", lines: ["Cocoa Crunch: roasted cocoa, dates and a pinch of sea salt.", "Peanut Power: roasted peanuts, dates and cardamom.", "Our Peanut Power bar boosts immunity, just in time for the festive season."] },
  { title: "Festive gift boxes", bodyFont: "Georgia", lines: ["A box of six costs ₹540, wrapped in our Diwali sleeve.", "Each box holds three Cocoa Crunch and three Peanut Power bars.", "Boxes reach partner stores within five working days."] },
  { title: "Why stores stock us", lines: ["India's #1 protein bar for festive gifting.", "A bright counter display that holds 24 bars.", "Display stands come free for partner stores."] },
  { title: "Diwali deal for shoppers", lines: ["20% off the 6-bar box until 30 November.", "Shoppers can redeem it in store or at urjabites.in."] },
  { title: "Made for festive evenings", lines: ["The perfect guilt-free treat after a big Diwali dinner.", "Pairs well with a cup of masala chai."] },
  { title: "Stock up early", lines: ["Hurry, festive stock ends soon!", "LIMITED BOXES for each store.", "Plan your counter space for the week before Diwali."] },
  { title: "A note for your shoppers", lines: ["Stop feeding your family junk this Diwali.", "Share a box of real ingredients instead."] },
  { title: "Let's make it a sweet Diwali", lines: ["Order your festive stock at urjabites.in/retail.", "Team Urja Bites, Pune"] },
];

// The deck after the creator fixed every finding: the version a reviewer approves.
const DECK_CORRECTED: Slide[] = [
  DECK[0],
  { title: "Why shoppers come back", lines: ["Roasted cocoa, peanuts and dates you can taste in every bite.", "Each bar has 12 g of protein and no added sugar.", "Loved by 35,000+ customers in Bengaluru, Pune and Mumbai.", "Rated 4.6 out of 5 by 1,200 buyers on urjabites.in."] },
  { title: "This season's flavours", lines: ["Cocoa Crunch: roasted cocoa, dates and a pinch of sea salt.", "Peanut Power: roasted peanuts, dates and cardamom.", "Both bars are made in our Pune kitchen, just in time for the festive season."] },
  { title: "Festive gift boxes", lines: DECK[3].lines },
  { title: "Why stores stock us", lines: ["The protein bar 35,000+ customers trust, now for festive gifting.", "A bright counter display that holds 24 bars.", "Display stands come free for partner stores."] },
  { title: "Diwali deal for shoppers", lines: ["20% off the 6-bar box until 30 November. T&C apply.", "Shoppers can redeem it in store or at urjabites.in."] },
  { title: "Made for festive evenings", lines: ["The perfect feel-good treat after a big Diwali dinner.", "Pairs well with a cup of masala chai."] },
  { title: "Planning your festive shelf", lines: ["Festive stock reaches stores in the first week of November.", "Each store gets a set number of boxes.", "Plan your counter space for the week before Diwali."] },
  { title: "A note for your shoppers", lines: ["Share a box of real ingredients this Diwali.", "Made with care in our Pune kitchen."] },
  DECK[9],
];

/** A one-page PDF written by hand: Helvetica (a standard font, not embedded), its text visible or invisible (mode 3). */
function handMadePdf(text: string, invisible: boolean): Buffer {
  const stream = `BT /F1 20 Tf ${invisible ? 3 : 0} Tr 72 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function deckHtml(slides: Slide[]) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  @page { size: 1280px 720px; margin: 0 }
  body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .s { width: 1280px; height: 720px; box-sizing: border-box; padding: 84px 96px 0 120px; position: relative; page-break-after: always; overflow: hidden; background: #FFF4E0; color: #4A2C1D; font-family: Inter }
  .s:last-child { page-break-after: auto }
  .s::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 28px; background: #F4A300 }
  .cover { background: #F4A300; padding-top: 150px } .cover::before { background: #2F7D32 }
  h1 { font-family: Poppins; font-weight: 700; font-size: 58px; line-height: 1.12; margin: 0 0 40px; max-width: 1000px }
  .cover h1 { font-size: 72px }
  ul { list-style: none; margin: 0; padding: 0 } li { font-size: 30px; line-height: 1.4; margin: 0 0 22px; max-width: 980px }
  li::before { content: "• "; color: #2F7D32; font-weight: 600 }
  .cover li { font-size: 32px } .cover li::before { content: "" }
  .logo { position: absolute; right: 96px; top: 64px; width: 240px }
  .foot { position: absolute; left: 120px; right: 96px; bottom: 40px; font-size: 18px; display: flex; justify-content: space-between; color: #4A2C1D }
  </style></head><body>${slides
    .map((s, i) => `<section class="s${s.cover ? " cover" : ""}">${s.cover ? `<img class="logo" alt="" src="data:image/png;base64,${URJA_LOGO_PNG_BASE64}">` : ""}<h1>${esc(s.title)}</h1><ul${s.bodyFont ? ` style="font-family:${s.bodyFont}"` : ""}>${s.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><div class="foot"><span>Urja Bites · Diwali retail deck</span><span>Page ${i + 1} of ${slides.length}</span></div></section>`)
    .join("")}</body></html>`;
}

// ── A4 documents: the clean one-pager and the Arial brochure ─────────────────
type A4Page = { title: string; paras: string[] };
function a4Html(pages: A4Page[], opts: { font?: string; head?: string } = {}) {
  const body = opts.font ?? "Inter";
  const head = opts.head ?? "Poppins";
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  @page { size: A4; margin: 0 }
  body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .p { height: 297mm; box-sizing: border-box; padding: 28mm 24mm; page-break-after: always; position: relative; background: #FFF4E0; color: #4A2C1D; font-family: ${body} }
  .p:last-child { page-break-after: auto }
  h1 { font-family: ${head}; font-weight: 700; font-size: 34pt; margin: 0 0 12mm } p { font-size: 14pt; line-height: 1.55; margin: 0 0 7mm }
  .logo { width: 60mm; margin-bottom: 12mm }
  </style></head><body>${pages
    .map((p, i) => `<section class="p">${i === 0 ? `<img class="logo" alt="" src="data:image/png;base64,${URJA_LOGO_PNG_BASE64}">` : ""}<h1>${esc(p.title)}</h1>${p.paras.map((t) => `<p>${esc(t)}</p>`).join("")}</section>`)
    .join("")}</body></html>`;
}

const ONE_PAGER: A4Page[] = [
  { title: "Cocoa Crunch", paras: ["Roasted cocoa, crunchy peanuts and dates in one bar.", "Each bar has 12 g of protein and no added sugar.", "A box of six costs ₹540.", "Find it in Bengaluru, Pune and Mumbai, or order a box at urjabites.in."] },
];

// p1 TERM-01 "energy bar", CLAIM-01 15% (the Dussehra offer, fact F-14, ended), VIS-03 Arial; p2 VIS-03 Arial.
const BROCHURE: A4Page[] = [
  { title: "Urja Bites for your store", paras: ["Our energy bar is made with roasted cocoa and dates.", "Enjoy 15% off the 6-bar box this week. T&C apply."] },
  { title: "Who buys it", paras: ["Trusted by 35,000+ customers in Bengaluru, Pune and Mumbai.", "Order a box at urjabites.in."] },
];

async function show(file: string) {
  const doc = await readPdf(new Uint8Array(readFileSync(file)));
  console.log(`\n${path.relative(process.cwd(), file)}: ${doc.pageCount} pages, ${(doc.size / 1024).toFixed(0)} KB, sha256 ${doc.hash.slice(0, 12)}…`);
  for (const p of doc.pages) console.log(`  p${p.n} [${p.fonts.map((f) => `${f.family} ${f.chars}`).join(", ")}] ${JSON.stringify(doc.body.slice(p.start, p.end)).slice(0, 110)}`);
  return doc;
}

// ── Letter spacing and code, as real decks set them ─────────────────────────────
// Kickers and badges with letter spacing come out of pdf.js as "P R O B L E M"; the reader restores the words from
// the glyphs the page draws. Lines of code in a fixed-width font stay separate lines. (Found in real decks, Phase 6.)
function letterSpacingHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  @page{size:1280px 720px;margin:0} body{margin:0;font-family:Inter} .s{padding:60px}
  .kicker{letter-spacing:.3em;text-transform:uppercase;font-weight:600;font-size:13px;color:#555}
  .badge{display:inline-block;letter-spacing:.12em;text-transform:uppercase;font-size:11px;font-weight:600;border:2px solid #111;border-radius:99px;padding:4px 12px;margin-right:12px}
  h1{font-family:Poppins;font-size:44px;margin:16px 0}
  pre{font-family:"Courier New",monospace;font-size:15px;background:#f3f3f3;padding:16px}
  </style></head><body><div class="s">
  <p class="kicker">Problem motivation · Part 1</p>
  <h1>Roasted cocoa and dates</h1>
  <p><span class="badge">About 19.6% of boxes sold out</span><span class="badge">Idle capital</span></p>
  <pre>class Menu {
    static void show() {
        System.out.println("Showing menu");
    }
}</pre>
  <p>A sentence of plain body text, set in Inter.</p>
  </div></body></html>`;
}

async function main() {
  if (process.argv.includes("--letter-spacing")) {
    print(letterSpacingHtml(), path.resolve("e2e/fixtures/letter-spacing.pdf"));
    return;
  }
  const deck = path.resolve("public/samples/urja-diwali-retail-deck.pdf");
  const onePager = path.resolve("public/samples/urja-cocoa-crunch-one-pager.pdf");
  const brochure = path.resolve("eval/docs/urja-store-brochure-arial.pdf");
  print(deckHtml(DECK), deck);
  const corrected = path.resolve("public/samples/urja-diwali-retail-deck-corrected.pdf");
  print(deckHtml(DECK_CORRECTED), corrected);
  print(a4Html(ONE_PAGER), onePager);
  print(a4Html(BROCHURE, { font: "Arial", head: "Arial" }), brochure);

  // Files the upload must refuse.
  const fx = path.resolve("e2e/fixtures");
  mkdirSync(fx, { recursive: true });
  print(deckHtml(Array.from({ length: 51 }, (_, i) => ({ title: `Page ${i + 1}`, lines: ["Roasted cocoa and dates."] }))), path.join(fx, "too-many-pages.pdf"));
  print(`<!doctype html><html><head><style>@page{size:A4;margin:0}body{margin:0}</style></head><body><img style="width:100%" src="data:image/png;base64,${readFileSync("public/samples/diwali-ad.png").toString("base64")}"></body></html>`, path.join(fx, "scanned.pdf"));
  writeFileSync(path.join(fx, "not-a-pdf.pdf"), "This is a plain text file with a .pdf name.\n");
  writeFileSync(path.join(fx, "empty.pdf"), "");
  const good = readFileSync(onePager);
  writeFileSync(path.join(fx, "damaged.pdf"), Buffer.concat([good.subarray(0, 400), Buffer.alloc(2000, 0x41)]));
  writeFileSync(path.join(fx, "ocr-scan.pdf"), handMadePdf("Scanned page: roasted cocoa and dates in every bar.", true));
  writeFileSync(path.join(fx, "standard-font.pdf"), handMadePdf("Roasted cocoa and dates in every bar.", false));
  print(letterSpacingHtml(), path.join(fx, "letter-spacing.pdf"));
  // A password-protected copy of the one-pager (pypdf, RC4-128: needs no extra library).
  execFileSync("python3", ["-I", "-c", "import sys; from pypdf import PdfReader, PdfWriter; w = PdfWriter(clone_from=PdfReader(sys.argv[1])); w.encrypt('urja', algorithm='RC4-128'); w.write(sys.argv[2])", onePager, path.join(fx, "password.pdf")]);

  const d = await show(deck);
  const o = await show(onePager);
  const b = await show(brochure);
  const fonts = (doc: typeof d) => new Set(doc.pages.flatMap((p) => p.fonts.map((f) => f.family)));
  const problems: string[] = [];
  const c = await show(corrected);
  // The approved copy of the corrected deck in every demo workspace's sample library (src/lib/seed/library.ts).
  writeFileSync("src/lib/seed/library-deck.json", JSON.stringify({ file: "/samples/urja-diwali-retail-deck-corrected.pdf", hash: c.hash, size: c.size, pageCount: c.pageCount, body: c.body, pages: c.pages }) + "\n");
  if (c.pageCount !== 10 || [...new Set(c.pages.flatMap((p) => p.fonts.map((f) => f.family)))].some((f) => !["Poppins", "Inter"].includes(f))) problems.push("corrected deck: not 10 pages in Poppins and Inter");
  const ocr = await readPdf(new Uint8Array(readFileSync(path.join(fx, "ocr-scan.pdf"))));
  if (!ocr.scanned) problems.push("ocr-scan.pdf was not recognised as a scan");
  const std = await readPdf(new Uint8Array(readFileSync(path.join(fx, "standard-font.pdf"))));
  if (std.scanned || std.pages[0].fonts[0]?.family !== "Helvetica") problems.push(`standard-font.pdf: expected visible Helvetica, got ${JSON.stringify(std.pages[0].fonts)}`);
  if (d.pageCount !== 10) problems.push(`deck has ${d.pageCount} pages`);
  if (!fonts(d).has("Poppins") || !fonts(d).has("Inter")) problems.push("deck: Poppins or Inter missing (did Google Fonts load?)");
  if (!d.pages[3].fonts.some((f) => f.family === "Georgia")) problems.push("deck page 4 is not in Georgia");
  if (d.pages.some((p, i) => i !== 3 && p.fonts.some((f) => !["Poppins", "Inter"].includes(f.family)))) problems.push("deck: a page other than 4 uses another font");
  if ([...fonts(o)].some((f) => !["Poppins", "Inter"].includes(f))) problems.push("one-pager uses a font other than Poppins and Inter");
  if (![...fonts(b)].every((f) => f === "Arial")) problems.push("brochure is not all Arial");

  console.log("\nFiles the upload must refuse:");
  for (const f of ["too-many-pages", "scanned", "not-a-pdf", "empty", "damaged", "password"]) {
    try {
      await readPdf(new Uint8Array(readFileSync(path.join(fx, `${f}.pdf`))));
      problems.push(`${f}.pdf was accepted`);
      console.log(`  ${f}: ACCEPTED`);
    } catch (e) {
      console.log(`  ${f}: ${e instanceof DocumentError ? `${e.code}: ${e.message}` : e}`);
    }
  }
  if (problems.length) {
    console.error("\nProblems:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  console.log("\nAll sample documents read back as intended.");
}
main().catch((e) => { console.error(e); process.exit(1); });
