// Code checks for claims: numbers against approved facts, superlatives, health claims,
// absolute claims and required disclaimers.
import type { CheckContext, Fact, FindingDraft, Rule } from "./types";
import { capitaliseLike, dayMonth, formatIndian, sentenceAt } from "./text";

function base(rule: Rule): Pick<FindingDraft, "category" | "severity" | "rule_code" | "field" | "label"> {
  return { category: rule.category, severity: rule.severity, rule_code: rule.code, field: "body", label: "code" };
}

export function factIsCurrent(f: Fact, today: string): boolean {
  return f.status === "approved" && (!f.expires_on || f.expires_on >= today);
}

type NumberClaim = { unit: "count" | "%" | "inr" | "g" | "rating"; value: number; plus: boolean; text: string; start: number; end: number; noun?: string };

const COUNT_NOUNS = "customers|customer|people|fans|gym-goers|buyers|families|users|members";

function parseNum(s: string): number {
  const m = s.replace(/,/g, "").trim().match(/^(\d+(?:\.\d+)?)\s*(k|lakh|l)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? 1_000 : 100_000) : 1;
  return n * mult;
}

/** Finds numbers that look like claims (people, percentages, prices, grams of protein, ratings). */
export function extractNumberClaims(text: string): NumberClaim[] {
  const out: NumberClaim[] = [];
  const add = (c: NumberClaim) => {
    if (!out.some((o) => o.start < c.end && c.start < o.end)) out.push(c);
  };
  for (const m of text.matchAll(new RegExp(`(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?\\s?(?:k|lakh)?)(\\+?)\\s+(?:happy\\s+|loyal\\s+)?(${COUNT_NOUNS})\\b`, "gi"))) {
    add({ unit: "count", value: parseNum(m[1]), plus: m[2] === "+", text: m[0], start: m.index!, end: m.index! + m[0].length, noun: m[3] });
  }
  for (const m of text.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%(\s?off)?/gi)) {
    add({ unit: "%", value: parseFloat(m[1]), plus: false, text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/(?:₹|Rs\.?\s?|INR\s?)(\d[\d,]*)/g)) {
    add({ unit: "inr", value: parseNum(m[1]), plus: false, text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?(?:g|gm|gms|grams?)\b(\s+of)?(\s+protein)?/gi)) {
    add({ unit: "g", value: parseFloat(m[1]), plus: false, text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/(\d(?:\.\d)?)\s?(?:\/\s?5|out of 5|stars?)/gi)) {
    add({ unit: "rating", value: parseFloat(m[1]), plus: false, text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return out.filter((c) => !Number.isNaN(c.value)).sort((a, b) => a.start - b.start);
}

function formatValue(f: Fact, claim: NumberClaim): string {
  const v = Number(f.value);
  switch (claim.unit) {
    case "count": return `${formatIndian(v)}${claim.plus || /\+/.test(f.statement) ? "+" : ""} customers`;
    case "%": return claim.text.replace(/\d{1,3}(?:\.\d+)?/, String(v));
    case "inr": return `₹${formatIndian(v)}`;
    case "g": return claim.text.replace(/\d+(?:\.\d+)?/, String(v));
    case "rating": return claim.text.replace(/\d(?:\.\d)?/, String(v));
  }
}

/** CLAIM-01: every number must match an approved, current fact. */
export function factsCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  for (const claim of extractNumberClaims(ctx.body)) {
    const sentence = (sentenceAt(ctx.body, claim.start)?.text ?? ctx.body).toLowerCase();
    if (claim.unit === "%" && !/\boff\b|discount|offer|sale|cashback|save/.test(sentence)) continue; // e.g. "100% natural": not a price claim
    if (claim.unit === "g" && !/protein/.test(sentence)) continue;
    const sameUnit = ctx.facts.filter((f) => f.kind === "number" && f.unit === claim.unit);
    const related = claim.unit === "%" || claim.unit === "count" || claim.unit === "rating" || claim.unit === "inr"
      ? sameUnit
      : sameUnit.filter((f) => f.keywords.some((k) => sentence.includes(k)));
    const current = related.filter((f) => factIsCurrent(f, ctx.today));
    const matches = (f: Fact) =>
      claim.unit === "count" ? claim.value <= Number(f.value) : Math.abs(claim.value - Number(f.value)) < 1e-9;

    if (current.some(matches)) continue;

    const outdated = related.find((f) => !factIsCurrent(f, ctx.today) && matches(f));
    const replacement = current.find((f) => f.keywords.some((k) => sentence.includes(k))) ?? current[0];

    if (outdated) {
      const ended = outdated.expires_on ? ` It ended on ${dayMonth(outdated.expires_on)}.` : "";
      out.push({
        ...base(rule), fact_code: outdated.code, quote: claim.text, start: claim.start, end: claim.end,
        message: `“${claim.text}” comes from an outdated fact, ${outdated.code}: ${outdated.statement}${ended}${replacement ? ` The current fact is ${replacement.code}: ${replacement.statement}` : ""}`,
        fix_kind: replacement ? "replace" : "none",
        fix_text: replacement ? formatValue(replacement, claim) : "Remove this number or ask the fact owner for a current figure.",
      });
    } else if (replacement) {
      out.push({
        ...base(rule), fact_code: replacement.code, quote: claim.text, start: claim.start, end: claim.end,
        message: `“${claim.text}” conflicts with approved fact ${replacement.code}: ${replacement.statement} (source: ${replacement.source}, owner: ${replacement.owner}).`,
        fix_kind: "replace",
        fix_text: formatValue(replacement, claim),
      });
    } else {
      out.push({
        ...base(rule), quote: claim.text, start: claim.start, end: claim.end,
        message: `No approved fact supports “${claim.text}”.`,
        fix_kind: "none",
        fix_text: "Remove the number, or ask the brand manager to add it to the fact ledger with a source.",
      });
    }
  }
  return out;
}

const SUPERLATIVE = /(?:\b(?:India['’]s|the world['’]s|the country['’]s|the)\s+)?(?:#1|No\.?\s?1\b|number one|best|tastiest|healthiest|top-rated|leading|unbeatable)(?:\s+([a-z]+(?:\s[a-z]+)?))?/gi;

/** CLAIM-02: rankings and superlatives need a cited source. */
export function superlativesCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  const countFact = ctx.facts.find((f) => f.unit === "count" && factIsCurrent(f, ctx.today));
  for (const m of ctx.body.matchAll(SUPERLATIVE)) {
    const noun = m[1]?.trim();
    const proof = ctx.facts.find((f) => factIsCurrent(f, ctx.today) && f.keywords.some((k) => ["ranking", "award", "#1", "best"].includes(k)));
    if (proof) continue;
    const fix = noun && countFact
      ? capitaliseLike(m[0], `the ${noun} ${formatIndian(Number(countFact.value))}+ customers trust`)
      : null;
    out.push({
      ...base(rule), quote: m[0], start: m.index!, end: m.index! + m[0].length,
      message: `“${m[0]}” is a superlative claim and no approved fact supports it. It needs a cited source, such as an independent ranking.`,
      fix_kind: fix ? "replace" : "none",
      fix_text: fix ?? "Remove the superlative, or attach the source that proves it.",
    });
  }
  return out;
}

const HEALTH: { re: RegExp; fix: string | null }[] = [
  { re: /\bcures?\b|\bcured\b/gi, fix: "is made for" },
  { re: /\bprevents?\b/gi, fix: null },
  { re: /\bboosts?\s+(?:your\s+)?immunity\b|\bimmunity[- ]boost(?:er|ing)?\b/gi, fix: null },
  { re: /\bdetox(?:es|ify)?\b/gi, fix: null },
  { re: /\bburns?\s+fat\b|\bfat[- ]burning\b/gi, fix: null },
  { re: /\bheals?\b/gi, fix: null },
];

/** CLAIM-03: no health or medical claims. */
export function healthClaimsCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  for (const h of HEALTH) {
    for (const m of ctx.body.matchAll(h.re)) {
      out.push({
        ...base(rule), quote: m[0], start: m.index!, end: m.index! + m[0].length,
        message: `“${m[0]}” is a health or medical claim. The guide forbids these, and they need regulatory proof.`,
        fix_kind: h.fix ? "replace" : "none",
        fix_text: h.fix ? capitaliseLike(m[0], h.fix) : "Remove this claim. Describe taste, ingredients or approved facts instead (for example 12 g of protein, fact F-10).",
      });
    }
  }
  return out;
}

/** ADV-01: absolute claims ("100%", "guaranteed") need proof. */
export function absolutesCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  for (const m of ctx.body.matchAll(/\b100%\s+guaranteed(?:\s+to)?|\bguaranteed(?:\s+to)?|\bzero risk\b|\bnever fails\b/gi)) {
    const toForm = /to$/i.test(m[0]);
    out.push({
      ...base(rule), quote: m[0], start: m.index!, end: m.index! + m[0].length,
      message: `“${m[0]}” is an absolute claim. Claims must be substantiated, and a guarantee needs proof.`,
      fix_kind: toForm ? "replace" : "none",
      fix_text: toForm ? capitaliseLike(m[0], "made to") : "Remove the guarantee or link to its terms.",
    });
  }
  return out;
}

/** DISC-01: offers and discounts need "T&C apply". */
export function disclaimerCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const required = String(rule.params.required ?? "T&C apply");
  if (ctx.body.toLowerCase().includes(required.toLowerCase())) return [];
  const triggers = (rule.params.triggers as string[]) ?? [];
  // Triggers are listed strongest first ("% off" before "offer"), so the finding lands on the actual promotion.
  let first: { index: number; text: string } | null = null;
  for (const t of triggers) {
    const i = ctx.body.toLowerCase().indexOf(t.toLowerCase());
    if (i >= 0) {
      first = { index: i, text: ctx.body.slice(i, i + t.length) };
      break;
    }
  }
  if (!first) return [];
  const s = sentenceAt(ctx.body, first.index);
  if (!s) return [];
  const withDot = /[.!?]$/.test(s.text) ? s.text : `${s.text}.`;
  return [{
    ...base(rule), quote: s.text, start: s.start, end: s.end,
    message: `This mentions an offer (“${first.text}”) but does not say “${required}”.`,
    fix_kind: "replace",
    fix_text: `${withDot} ${required}.`,
  }];
}
