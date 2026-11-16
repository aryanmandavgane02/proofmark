// Builds the demo brand guide and the guideline update as real PDFs (headless Chrome),
// then reads them back and checks that every rule's quote is on the page the rule cites.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { guidePages, GUIDE_UPDATE, type GuidePage } from "../src/lib/seed/guide";
import { RULES } from "../src/lib/seed/urja";
import { locateQuote } from "../src/lib/checks/proof";
import { URJA_LOGO_SVG } from "../src/lib/seed/logo";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function html(pages: GuidePage[], footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 0 }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #4A2C1D }
  .page { height: 297mm; box-sizing: border-box; padding: 26mm 22mm; page-break-after: always; position: relative; background: #FFF4E0 }
  .page:last-child { page-break-after: auto }
  h1 { font-size: 30pt; margin: 0 0 12mm; color: #4A2C1D } p { font-size: 13pt; line-height: 1.55; margin: 0 0 6mm }
  .n { position: absolute; bottom: 14mm; right: 22mm; font-size: 10pt } .f { position: absolute; bottom: 14mm; left: 22mm; font-size: 10pt }
  .logo { width: 70mm; margin-bottom: 14mm }
  </style></head><body>${pages
    .map((p, i) => `<section class="page">${i === 0 ? `<div class="logo">${URJA_LOGO_SVG.replace('width="480" height="160"', 'width="100%"')}</div>` : ""}<h1>${esc(p.title)}</h1>${p.blocks.map((b) => `<p>${esc(b)}</p>`).join("")}<span class="f">${esc(footer)}</span><span class="n">${i + 1}</span></section>`)
    .join("")}</body></html>`;
}

function print(name: string, pages: GuidePage[], footer: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "guide-"));
  const src = path.join(dir, "guide.html");
  writeFileSync(src, html(pages, footer));
  const out = path.resolve("public/samples", name);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--user-data-dir=${dir}/p`, `--print-to-pdf=${out}`, `file://${src}`], { stdio: "ignore" });
  return out;
}

async function pagesText(file: string) {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
  return (await extractText(pdf, { mergePages: false })).text as string[];
}

async function main() {
  const guide = print("urja-brand-guide.pdf", guidePages(), "Urja Bites Brand Guide v1 (2026)");
  const update = print("urja-guideline-update-nov-2026.pdf", GUIDE_UPDATE, "Urja Bites guideline update, November 2026");
  const text = await pagesText(guide);
  let bad = 0;
  for (const r of RULES.filter((x) => !x.builtin)) {
    const ok = !!locateQuote(text[(r.source_page ?? 0) - 1] ?? "", r.source_quote);
    if (!ok) bad++;
    console.log(`${ok ? "ok " : "MISSING"} ${r.code} on page ${r.source_page}`);
  }
  console.log(`guide: ${text.length} pages; update: ${(await pagesText(update)).length} pages; ${bad ? bad + " quote(s) missing" : "every quote is on its page"}`);
  if (bad) process.exit(1);
}
main();
