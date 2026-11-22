// Font names inside PDFs, made comparable with the brand's typefaces. Pure: used by the reader and by the typeface check.

const STYLE_WORDS = /(?:bold|regular|italic|light|medium|semibold|demibold|extrabold|ultrabold|black|thin|extralight|ultralight|heavy|book|oblique|condensed|variable|vf|mt|psmt|ps|\d+pt)$/i;

/** "AAAAAA+Poppins-Bold" → "Poppins"; "ArialMT" → "Arial"; "Inter_18pt-Regular" → "Inter"; "Times New Roman,Bold" → "Times New Roman". */
export function fontFamily(raw: string): string {
  let n = raw.replace(/^[A-Z]{6}\+/, "").trim();
  n = n.split(/[-,_]/)[0].trim();
  for (let i = 0; i < 4; i++) {
    const m = n.match(STYLE_WORDS);
    if (!m || m.index === 0) break;
    n = n.slice(0, m.index).trim();
  }
  return n || raw;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Same family, allowing the family's own optical or width cuts ("Inter Display", "InterVariable"). Not "Interstate". */
export function sameFamily(fontName: string, typeface: string): boolean {
  const a = key(fontFamily(fontName));
  const b = key(typeface);
  if (!a || !b) return false;
  return a === b || (a.startsWith(b) && /^(display|text|tight|\d+pt|variable|vf)$/.test(a.slice(b.length)));
}

/** Icon, symbol and emoji fonts are not typefaces for words, so the typeface check ignores them. */
export function isSymbolFont(name: string): boolean {
  return /symbol|dingbat|wingding|webding|zapf|emoji|awesome|materialicons|material icons|material symbols|glyphicons|icomoon|marlett|segoe ?mdl2/i.test(name);
}

/**
 * Some tools write a code instead of the font's name into the PDF ("YAFdJt8dAY0", "TT2Ao00"). Such a name says
 * nothing about the typeface, so a finding about it is left to a person instead of being stated as a fact.
 */
export function looksLikeHiddenName(family: string): boolean {
  const f = family.trim();
  if (/^TT[0-9A-F]+o\d+$/i.test(f) || /^(?:F|T3_?Font_?)\d+$/i.test(f)) return true;
  return /^[A-Za-z0-9_-]{8,}$/.test(f) && /\d/.test(f) && /[a-z]/.test(f) && /[A-Z]/.test(f) && !/^[A-Z][a-z]+(?:[A-Z][a-z]+)*\d*$/.test(f);
}
