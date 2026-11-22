// Outdated-content alerts (Round 3, improvement 2): where approved content relies on a fact. Pure: no database.
// Numbers are read with the same reader as the facts check (CLAIM-01) and matched by unit and value, so an alert
// and a re-check never disagree about what "relies on F-12" means. Text facts are matched by their keywords.
import { extractNumberClaims } from "@/lib/checks/claims";
import { findPhrase, sentenceAt, sentences } from "@/lib/checks/text";
import { pageAt } from "@/lib/documents/pages";
import type { DocPage } from "@/lib/checks/types";

/** The parts of a fact that detection needs (a database row or a seed fact both fit). */
export type FactShape = { code: string; statement: string; kind: string; value: number | string | null; unit: string | null; keywords: string[]; expires_on?: string | null };
/** Where a text relies on a fact: the quoted number ("quotes"), or a sentence naming it ("mentions"). */
export type Evidence = { quote: string; start: number; end: number; page: number | null; how: "quotes" | "mentions" };

const OFFER = /\boff\b|discount|offer|sale|cashback|save/i;
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const num = (v: number | string | null) => (v == null ? NaN : Number(v));

/** The numbers written in a fact's statement ("Rated 4.6 out of 5 by 1,200 buyers" → 4.6, 5, 1200). */
function statementNumbers(f: FactShape): number[] {
  return [...f.statement.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => !Number.isNaN(n));
}

type Claim = ReturnType<typeof extractNumberClaims>[number];

// Words every offer shares; the other keywords of an offer fact ("diwali") tell one offer from another.
const GENERIC = new Set(["off", "offer", "offers", "discount", "discounts", "sale", "deal", "deals", "cashback", "save", "coupon", "price", "box", "only", "just", "mrp", "costs"]);
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_LONG = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** A fact's end date as people write it: "30 Nov", "30th November", "Nov 30", "30/11". */
export function endDatePattern(iso: string | null | undefined): RegExp | null {
  const m = iso?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const d = `0?${day}(?:st|nd|rd|th)?`;
  const mon = `(?:${MONTHS_LONG[month - 1]}|${MONTHS[month - 1]})\\.?(?![a-z])`;
  return new RegExp(`(?<![\\d])(?:${d}\\s*(?:of\\s+)?${mon}|${mon}\\s*${d}(?![\\d])|${day}\\s*[/.-]\\s*0?${month}(?![\\d]))`, "i");
}

/**
 * Offers share their numbers ("20% off" is common). When an offer fact has something of its own (a keyword such as
 * "diwali", or its end date), the text must name it somewhere, so an unrelated 20% sale does not count as this offer.
 */
function offerNamed(fact: FactShape, text: string): boolean {
  const own = fact.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 3 && !GENERIC.has(k));
  const date = endDatePattern(fact.expires_on);
  if (!own.length && !date) return true;
  return own.some((k) => findPhrase(text, k).length > 0) || (!!date && date.test(text));
}

/** A price worked out from the box price and an offer ("₹432" is ₹540 with 20% off): it relies on both facts. */
function offerPrice(fact: FactShape, claim: Claim, facts: FactShape[], text: string): boolean {
  if (claim.unit !== "inr") return false;
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  if (fact.unit === "%") return offerNamed(fact, text) && facts.some((q) => q.unit === "inr" && near(claim.value, num(q.value) * (1 - num(fact.value) / 100)));
  if (fact.unit === "inr") return facts.some((p) => p.unit === "%" && near(claim.value, num(fact.value) * (1 - num(p.value) / 100)));
  return false;
}

/** Whether a number claim in a sentence is this fact's number. `text` is the whole draft, for naming the offer. */
export function claimReliesOn(fact: FactShape, claim: Claim, sentence: string, facts: FactShape[], text = sentence): boolean {
  const v = num(fact.value);
  if (fact.kind !== "number" || Number.isNaN(v) || claim.unit !== fact.unit) return false;
  if (claim.unit === "%" && !OFFER.test(sentence)) return false; // "100% natural" is not an offer
  if (claim.unit === "%" && !offerNamed(fact, text)) return false; // a 20% sale that is not this offer
  if (claim.unit === "g" && !/protein/i.test(sentence)) return false;
  const others = facts.filter((f) => f.code !== fact.code);
  if (same(claim.value, v)) {
    // Two facts with the same number (say two 20% offers): the sentence must name this one.
    const twin = others.some((f) => f.kind === "number" && f.unit === fact.unit && same(num(f.value), v));
    return !twin || fact.keywords.some((k) => findPhrase(sentence, k).length > 0);
  }
  if (claim.unit !== "count") return false;
  // A smaller count ("30,000+ customers") is backed by this fact, as the facts check accepts it, unless the number belongs
  // to another fact ("1,200 buyers" is in the rating fact) or is too small to be about the same people ("350 people").
  if (others.some((f) => (f.unit === "count" && same(num(f.value), claim.value)) || statementNumbers(f).some((n) => same(n, claim.value)))) return false;
  return claim.value < v && claim.value >= 0.5 * v;
}

/** The places a text quotes a number fact's value. */
export function quotesOf(fact: FactShape, body: string, pages: DocPage[] | undefined, facts: FactShape[]): Evidence[] {
  if (fact.kind !== "number") return [];
  return extractNumberClaims(body)
    .filter((c) => claimReliesOn(fact, c, sentenceAt(body, c.start)?.text ?? body, facts, body) || offerPrice(fact, c, facts, body))
    .map((c) => ({ quote: c.text, start: c.start, end: c.end, page: pageAt(pages ?? [], c.start), how: "quotes" as const }));
}

const STOP = new Set(["the", "a", "an", "of", "in", "on", "at", "for", "to", "and", "or", "with", "by", "as", "is", "are", "our", "your", "we", "you", "it", "this", "that", "from", "be", "has", "have"]);
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Three-word phrases from a fact's wording, without numbers and with at least two real words ("no added sugar"). */
export function factPhrases(fact: FactShape): string[] {
  const out: string[] = [];
  const toks = words(fact.statement);
  for (let i = 0; i + 3 <= toks.length; i++) {
    const w = toks.slice(i, i + 3);
    // At least two real words: "on urjabites in" is a web address and small words, not a phrase of the fact.
    if (w.some((t) => /\d/.test(t)) || w.filter((t) => !STOP.has(t)).length < 2) continue;
    out.push(w.join(" "));
  }
  return out;
}

/** The sentences that name a fact: two of its keywords (or its only one) as whole words, or a phrase from its wording. */
export function mentionsOf(fact: FactShape, body: string, pages: DocPage[] | undefined): Evidence[] {
  const keys = [...new Set(fact.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 3))];
  const phrases = factPhrases(fact);
  const date = endDatePattern(fact.expires_on);
  if (!keys.length && !phrases.length) return [];
  const need = Math.min(2, keys.length);
  return sentences(body)
    .filter((s) => {
      const named = keys.filter((k) => findPhrase(s.text, k).length > 0).length;
      if (keys.length && named >= need) return true;
      // An offer named by its end date: "Festive offer still live, but only till Nov 30!"
      if (date && named >= 1 && date.test(s.text)) return true;
      const flat = ` ${words(s.text).join(" ")} `;
      return phrases.some((p) => flat.includes(` ${p} `));
    })
    .map((s) => {
      const end = s.start + Math.min(s.text.length, 200);
      return { quote: body.slice(s.start, end), start: s.start, end, page: pageAt(pages ?? [], s.start), how: "mentions" as const };
    });
}

/**
 * How a text relies on a fact. "value": a number fact's value is quoted (what a changed number makes wrong), or a
 * text fact is named. "any": also any sentence naming the fact (what an ending offer makes out of date).
 */
export function reliance(fact: FactShape, body: string, pages: DocPage[] | undefined, facts: FactShape[], how: "value" | "any"): Evidence[] {
  if (fact.kind !== "number") return mentionsOf(fact, body, pages);
  const quotes = quotesOf(fact, body, pages, facts);
  if (how === "value") return quotes;
  const extra = mentionsOf(fact, body, pages).filter((m) => !quotes.some((q) => q.start < m.end && m.start < q.end));
  return [...quotes, ...extra].sort((a, b) => a.start - b.start);
}

/** What changed in a fact, and whether approved content needs alerts for it. */
export function factChange(before: FactShape & { expires_on: string | null }, after: FactShape & { expires_on: string | null }) {
  const valueChanged = before.kind === "number" || after.kind === "number"
    ? !(before.kind === after.kind && before.unit === after.unit && same(num(before.value), num(after.value)))
    : false;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  const wordingChanged = norm(before.statement) !== norm(after.statement) || before.keywords.join(",") !== after.keywords.join(",");
  const expiryChanged = (before.expires_on ?? null) !== (after.expires_on ?? null) && !!after.expires_on;
  return {
    valueChanged,
    wordingChanged,
    expiryChanged,
    /** A number fact needs alerts when its number changes; a text fact when its wording changes. */
    alerts: before.kind === "number" ? valueChanged : wordingChanged || valueChanged,
  };
}

/** "35,000+ customers" style summary of a number fact for messages; the statement for a text fact. */
export function factLabel(f: FactShape): string {
  return f.statement.replace(/\s+/g, " ").trim().replace(/\.$/, "");
}
