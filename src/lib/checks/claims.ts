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

// Words for groups of people that a count of customers is written with (English and Hinglish: "35 hazaar+ logon").
const COUNT_NOUNS = "customers|customer|people|fans|gym-goers|buyers|families|users|members|indians|shoppers|snackers|foodies|logon|log";
// Multipliers written after a number: 35k, 35 thousand, 35 hazaar (Hindi), 1.2 lakh, 2 crore.
const MULTIPLIERS = "k|thousand|hazaar|hazar|lakhs|lakh|crores|crore|million|mn";

function multiplier(word: string | undefined): number {
  const w = (word ?? "").toLowerCase();
  if (!w) return 1;
  if (w === "k" || w === "thousand" || w.startsWith("haza")) return 1_000;
  if (w.startsWith("lakh") || w === "l") return 100_000;
  if (w.startsWith("crore")) return 10_000_000;
  if (w === "million" || w === "mn") return 1_000_000;
  return NaN;
}

function parseNum(s: string): number {
  const m = s.replace(/,/g, "").trim().match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${MULTIPLIERS}|l)?$`, "i"));
  if (!m) return NaN;
  return parseFloat(m[1]) * multiplier(m[2]);
}

// Numbers written in words: "thirty-five thousand", "one lakh", "twelve hundred".
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE_WORDS: Record<string, number> = { thousand: 1_000, lakh: 100_000, lakhs: 100_000, million: 1_000_000, crore: 10_000_000, crores: 10_000_000 };
const WORD_ALT = [...Object.keys(NUMBER_WORDS), "hundred", ...Object.keys(SCALE_WORDS)].sort((a, b) => b.length - a.length).join("|");

/** "thirty-five thousand" → 35000; NaN for anything else. */
export function wordsToNumber(words: string): number {
  let total = 0;
  let current = 0;
  let any = false;
  for (const w of words.toLowerCase().split(/[\s-]+/).filter(Boolean)) {
    if (w === "and") continue;
    if (w in NUMBER_WORDS) current += NUMBER_WORDS[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w in SCALE_WORDS) {
      total += (current || 1) * SCALE_WORDS[w];
      current = 0;
    } else return NaN;
    any = true;
  }
  return any ? total + current : NaN;
}

/** Finds numbers that look like claims (people, percentages, prices, grams of protein, ratings). */
export function extractNumberClaims(text: string): NumberClaim[] {
  const out: NumberClaim[] = [];
  const add = (c: NumberClaim) => {
    if (!out.some((o) => o.start < c.end && c.start < o.end)) out.push(c);
  };
  for (const m of text.matchAll(new RegExp(`(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?\\s?(?:(?:${MULTIPLIERS})(?![a-z]))?)(\\+|\\s?plus)?\\s+(?:happy\\s+|loyal\\s+)?(${COUNT_NOUNS})\\b`, "gi"))) {
    add({ unit: "count", value: parseNum(m[1]), plus: !!m[2], text: m[0], start: m.index!, end: m.index! + m[0].length, noun: m[3] });
  }
  for (const m of text.matchAll(new RegExp(`\\b((?:${WORD_ALT})(?:[\\s-]+(?:and[\\s-]+)?(?:${WORD_ALT}))*)(\\+|\\s?plus)?\\s+(?:happy\\s+|loyal\\s+)?(${COUNT_NOUNS})\\b`, "gi"))) {
    add({ unit: "count", value: wordsToNumber(m[1]), plus: !!m[2], text: m[0], start: m.index!, end: m.index! + m[0].length, noun: m[3] });
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
  for (const m of text.matchAll(/(\d(?:\.\d)?)\s?(?:\/\s?5|out of 5|stars?|★|⭐)/gi)) {
    add({ unit: "rating", value: parseFloat(m[1]), plus: false, text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  // The noun first, as on a stats slide: "Customer base: 35K+", "Customers – 35,000". Last, so a rating still wins.
  for (const m of text.matchAll(new RegExp(`\\b(${COUNT_NOUNS})(?:\\s+(?:base|count|community|served))?\\s*[:\\u2013\\u2014-]\\s*(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?\\s?(?:(?:${MULTIPLIERS})(?![a-z]))?)(\\+|\\s?plus)?`, "gi"))) {
    add({ unit: "count", value: parseNum(m[2]), plus: !!m[3], text: m[0], start: m.index!, end: m.index! + m[0].length, noun: m[1] });
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

// "#1" is a ranking, not "#13" or a reference in code ("invokespecial #1 // Method"); the product name after it stays on the same line.
const SUPERLATIVE = /(?:\b(?:India['’]s|the world['’]s|the country['’]s|the)[ \t]+)?(?:#1(?!\d)(?![ \t]*(?:\/\/|=))|No\.?\s?1\b|number one|best|tastiest|healthiest|top-rated|leading|unbeatable)(?:[ \t]+((?!(?:in|for|of|at|on|to|with|and|ever|yet|we|you|they|it|is|are|was|can|will|that|this|our|your)\b)[a-z]+(?:[ \t](?!(?:in|for|of|at|on|to|with|and|ever|yet|we|you|they|it|is|are|was|can|will|that|this|our|your)\b)[a-z]+)?))?/gi;

/** Words that number things rather than rank them: "Order #1", "Step #1", "Issue #1". */
const NUMBERING = /\b(?:order|issue|step|ticket|item|slide|page|part|chapter|episode|volume|case|room|table|batch|invoice|row|line|level|round|task|question|exercise|example|figure|test|bug|version)[ \t]*$/i;

/** CLAIM-02: rankings and superlatives need a cited source. */
export function superlativesCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  const countFact = ctx.facts.find((f) => f.unit === "count" && factIsCurrent(f, ctx.today));
  for (const m of ctx.body.matchAll(SUPERLATIVE)) {
    if (m[0].startsWith("#") && NUMBERING.test(ctx.body.slice(Math.max(0, m.index! - 24), m.index!))) continue; // "Order #1, #2"
    const noun = m[1]?.trim().toLowerCase();
    const proof = ctx.facts.find((f) => factIsCurrent(f, ctx.today) && f.keywords.some((k) => ["ranking", "award", "#1", "best"].includes(k)));
    if (proof) continue;
    const fix = noun && countFact
      ? capitaliseLike(m[0], `the ${noun} ${formatIndian(Number(countFact.value))}+ customers trust`)
      : null;
    out.push({
      ...base(rule), quote: m[0], start: m.index!, end: m.index! + m[0].length,
      // Plain words (user tests, Round 3): "superlative" is a term people did not know.
      message: `“${m[0]}” claims to be better than every other product, and no approved fact backs that up. A claim like this needs a cited source, such as an independent ranking.`,
      fix_kind: fix ? "replace" : "none",
      fix_text: fix ?? "Remove the superlative, or attach the source that proves it.",
    });
  }
  return out;
}

// "Prevents" is a health claim when it is about health ("prevents colds", "helps prevent heart disease"), not in "the
// pack prevents spills" or "prevents steps from being too long". Subtler wording is left to the AI (CLAIM-03 is both).
const AILMENTS = "diseases?|illness(?:es)?|infections?|cancers?|diabetes|heart|cholesterol|blood|hypertension|obesity|weight|colds?|flu|coughs?|fevers?|fatigue|tiredness|cramps?|ageing|aging|wrinkles|inflammation|deficienc(?:y|ies)|ana?emia|osteoporosis|hair|acne|strokes?|allerg(?:y|ies)|constipation|bloating|acidity|indigestion|ulcers?|kidney|cavities|tooth|teeth|muscle|bone|dementia|alzheimer['’]?s|arthritis|asthma|depression|anxiety|insomnia|migraines?|headaches?|injur(?:y|ies)|sickness|immunity";
const PREVENTS = new RegExp(`\\bprevent(?:s|ing)?\\b(?:[ \\t]+[\\p{L}'’-]+){0,3}?[ \\t]+(?:${AILMENTS})\\b(?:[ \\t]+(?:disease|attack|pressure|sugar|stones?|decay|fall|loss|gain))?`, "giu");

const HEALTH: { re: RegExp; fix: string | null }[] = [
  { re: /\bcures?\b|\bcured\b/gi, fix: "is made for" },
  { re: PREVENTS, fix: null },
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
/** An offer word as a word: "deal" and "deals", not "ideal", "dealing" or "deal with"; "sale", not "wholesale"; "20% off". */
function offerWord(trigger: string): RegExp {
  const t = trigger.trim();
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = /^[\p{L}\p{N}]/u.test(t) ? "(?<![\\p{L}\\p{N}])" : "";
  const after = /[\p{L}\p{N}]$/u.test(t) ? "(?:s|es|ed)?(?![\\p{L}\\p{N}])" : "";
  const verb = /^deal$/i.test(t) ? "(?![ \\t]+with\\b)" : ""; // "how to deal with" is not an offer
  return new RegExp(`${before}${esc}${after}${verb}`, "iu");
}

export function disclaimerCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const required = String(rule.params.required ?? "T&C apply");
  if (ctx.body.toLowerCase().includes(required.toLowerCase())) return [];
  const triggers = (rule.params.triggers as string[]) ?? [];
  // Triggers are listed strongest first ("% off" before "offer"), so the finding lands on the actual promotion.
  let first: { index: number; text: string } | null = null;
  for (const t of triggers) {
    const m = offerWord(t).exec(ctx.body);
    if (m) {
      first = { index: m.index, text: m[0] };
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
