// A document draft, page by page: each page's text with its findings highlighted, the fonts it uses, and a link to
// that page in the exact stored PDF. The page index shows at a glance which pages need work.
import type { DocPage, Typeface } from "@/lib/checks/types";
import { isSymbolFont, looksLikeHiddenName, sameFamily } from "@/lib/documents/fonts";
import { Highlighted, type Mark } from "./Highlighted";
import { formatBytes } from "@/lib/bytes";
import { MAX_PICTURES, pageList } from "@/lib/documents/pages";

const RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2 };
const CHIP: Record<string, string> = {
  blocker: "border-red/50 bg-[#fde0dd] text-[#8a1c12]",
  major: "border-amber/60 bg-[#ffecc7] text-[#7a3d00]",
  minor: "border-line bg-[#e3e7f3] text-primary-d",
  clean: "border-accent/40 bg-[#e8f4ec] text-[#0a5c4f]",
};

export function DocumentView(props: {
  body: string; pages: DocPage[]; scanned: boolean; fileUrl: string | null; fileName: string; fileSize: number; fileHash: string;
  marks: Mark[]; findingsByPage: Map<number, { severity: string }[]>; typefaces: Typeface[];
  /** Whether the AI read the words in the largest pictures: "read", "running", or "not_read" (AI off or unavailable). */
  picturesRead?: "read" | "running" | "not_read";
}) {
  const { body, pages, fileUrl, marks, findingsByPage, typefaces } = props;
  const worst = (n: number) => (findingsByPage.get(n) ?? []).map((f) => f.severity).sort((a, b) => RANK[a] - RANK[b])[0];
  const textless = pages.filter((p) => !body.slice(p.start, p.end).trim()).map((p) => p.n);
  // Pages with pictures (documents read since Block 2 count them): their text is checked, the pictures are not.
  const pictured = pages.filter((p) => (p.pictures ?? 0) > 0 && !textless.includes(p.n)).map((p) => p.n);
  const plural = pictured.length > 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-soft p-3 text-sm">
        <span aria-hidden>📄</span>
        <span className="font-semibold text-ink">{props.fileName}</span>
        <span className="text-muted">{formatBytes(props.fileSize)} · {pages.length} page{pages.length > 1 ? "s" : ""}</span>
        <span className="font-mono text-xs text-muted" title={`SHA-256 ${props.fileHash}`}>SHA-256 {props.fileHash.slice(0, 12)}…</span>
        {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="ml-auto font-semibold text-primary hover:underline">Open the PDF ↗</a>}
      </div>
      {props.scanned && (
        <p className="rounded-lg bg-[#fff6e5] p-3 text-sm text-[#7a3d00]">This looks like a scan with a hidden text layer. Its words were checked, but its typefaces could not be, so look at the design yourself.</p>
      )}
      {textless.length > 0 && (
        <p className="rounded-lg bg-[#fff6e5] p-3 text-sm text-[#7a3d00]">
          {textless.length === pages.length ? "No page" : textless.length === 1 ? `Page ${textless[0]}` : `Pages ${textless.join(", ")}`} {textless.length === 1 ? "has" : "have"} no text (pictures only), so {textless.length === 1 ? "it was" : "they were"} not checked. Look at {textless.length === 1 ? "it" : "them"} in the PDF.
        </p>
      )}
      {pictured.length > 0 && (
        <p className="rounded-lg border border-line bg-soft p-3 text-sm text-primary-d">
          {pageList(pictured).replace(/^p/, "P")} {plural ? "have" : "has"} pictures.{" "}
          {props.picturesRead === "read"
            ? `The AI read the words in the pictures (the ${MAX_PICTURES} largest, if there are more) and they were checked for claims and terms (shown as “In the picture on page …”). Logos, colours and photos themselves are not checked: look at ${plural ? "those" : "it"} in the PDF.`
            : props.picturesRead === "running"
              ? "The AI is reading the words in the largest pictures; any claims in them appear with the AI findings."
              : `The page text was checked, but not what is inside the pictures (the AI did not run): look at ${plural ? "those" : "it"} in the PDF.`}
        </p>
      )}
      <nav aria-label="Pages" className="flex flex-wrap gap-1.5">
        {pages.map((p) => {
          const n = (findingsByPage.get(p.n) ?? []).length;
          const empty = textless.includes(p.n);
          return (
            <a key={p.n} href={`#page-${p.n}`} className={`rounded-md border px-2 py-1 text-xs font-semibold hover:brightness-95 ${empty ? "border-line bg-surface text-muted" : CHIP[worst(p.n) ?? "clean"]}`}>
              Page {p.n}<span className="sr-only">:</span> {empty ? "· no text" : n ? `· ${n}` : "✓"}<span className="sr-only">{empty ? "" : n ? ` finding${n > 1 ? "s" : ""}` : " no findings"}</span>
            </a>
          );
        })}
      </nav>
      {pages.map((p) => {
        const text = body.slice(p.start, p.end);
        const local = marks
          .filter((m) => m.end > p.start && m.start < p.end)
          .map((m) => ({ ...m, start: Math.max(0, m.start - p.start), end: Math.min(text.length, m.end - p.start) }));
        const fonts = p.fonts.filter((f) => f.chars > 0 && !isSymbolFont(f.family));
        return (
          <section key={p.n} id={`page-${p.n}`} aria-labelledby={`page-${p.n}-h`} className="scroll-mt-24 border-t border-line pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`page-${p.n}-h`} className="text-sm font-bold text-primary-d">Page {p.n}</h3>
              <span className="flex flex-wrap items-baseline gap-2">
                {pictured.includes(p.n) && <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">{p.pictures} picture{p.pictures! > 1 ? "s" : ""}</span>}
                {fileUrl && <a href={`${fileUrl}#page=${p.n}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Open page {p.n} in the PDF ↗</a>}
              </span>
            </div>
            {fonts.length > 0 && !props.scanned && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Fonts:
                {fonts.map((f) => {
                  const ok = typefaces.some((t) => sameFamily(f.family, t.name));
                  if (f.family === "(unnamed font)" || looksLikeHiddenName(f.family)) {
                    return <span key={f.family} className="rounded border border-line px-1.5 py-0.5 font-semibold text-muted" title="The PDF does not name this font">{f.family} ?<span className="sr-only"> (name not readable)</span></span>;
                  }
                  return (
                    <span key={f.family} className={`rounded border px-1.5 py-0.5 font-semibold ${ok ? CHIP.clean : CHIP.major}`}>
                      {f.family} {ok ? "✓" : "✗"}<span className="sr-only">{ok ? " (brand typeface)" : " (not a brand typeface)"}</span>
                    </span>
                  );
                })}
              </p>
            )}
            <div className="mt-2">
              {text.trim() ? <Highlighted text={text} marks={local} /> : <p className="text-sm italic text-muted">No text on this page (pictures only), so look at it in the PDF.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
