// Code checks for terminology, tone and social-media style rules.
import type { CheckContext, FindingDraft, Rule } from "./types";
import { CHANNEL_LABEL } from "./types";
import { pageAt, pageList } from "@/lib/documents/pages";
import { capitaliseLike, dayMonth, findPhrase, sentenceAt, sentences, wordCount } from "./text";

function base(rule: Rule): Pick<FindingDraft, "category" | "severity" | "rule_code" | "field" | "label"> {
  return { category: rule.category, severity: rule.severity, rule_code: rule.code, field: "body", label: "code" };
}

/** TERM-01: words to avoid from the glossary, each with its preferred term. */
export function glossaryCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const out: FindingDraft[] = [];
  const taken: [number, number][] = [];
  for (const term of ctx.terms.filter((t) => t.rule_code === rule.code)) {
    for (const avoid of [...term.avoid].sort((a, b) => b.length - a.length)) {
      for (const m of findPhrase(ctx.body, avoid, term.case_sensitive)) {
        if (taken.some(([s, e]) => m.start < e && s < m.end)) continue;
        taken.push([m.start, m.end]);
        out.push({
          ...base(rule),
          quote: m.text,
          start: m.start,
          end: m.end,
          message: `“${m.text}” is not an approved term. Use “${term.preferred}”. ${term.reason}`,
          fix_kind: "replace",
          fix_text: term.case_sensitive ? term.preferred : capitaliseLike(m.text, term.preferred),
        });
      }
    }
  }
  return out;
}

/** TONE-02: sentences that are too long to read comfortably. */
export function readabilityCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const max = Number(rule.params.max_sentence_words ?? 25);
  const all = sentences(ctx.body).filter((s) => wordCount(s.text) > 0);
  const tooLong = all
    .filter((s) => wordCount(s.text) > max)
    .map((s) => ({
      ...base(rule),
      quote: s.text,
      start: s.start,
      end: s.end,
      message: `This sentence has ${wordCount(s.text)} words. The guide asks for short sentences (at most ${max} words here).`,
      fix_kind: "none" as const,
      fix_text: "Split it into two or three sentences, one idea each.",
    }));
  // Reading level per channel: the average sentence length the guide allows on this channel (shorter for ads).
  const perChannel = (rule.params.max_avg_words ?? {}) as Record<string, number>;
  const avgMax = Number(perChannel[ctx.channel]);
  if (!all.length || !avgMax) return tooLong;
  const avg = all.reduce((n, s) => n + wordCount(s.text), 0) / all.length;
  if (avg <= avgMax) return tooLong;
  const longest = [...all].sort((a, b) => wordCount(b.text) - wordCount(a.text))[0];
  if (tooLong.some((f) => f.start === longest.start)) return tooLong; // already flagged as too long
  return [...tooLong, {
    ...base(rule), quote: longest.text, start: longest.start, end: longest.end,
    message: `Sentences here average ${Math.round(avg)} words; for ${CHANNEL_LABEL[ctx.channel].toLowerCase()} the guide asks for ${avgMax} or fewer on average. This is the longest one.`,
    fix_kind: "none" as const,
    fix_text: "Shorten the longest sentences, one idea each, until the average fits.",
  }];
}

/** TONE-03: whole words in capital letters. */
export function allCapsCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const allow = new Set(((rule.params.allow as string[]) ?? []).map((s) => s.toUpperCase()));
  const words: { start: number; end: number }[] = [];
  for (const m of ctx.body.matchAll(/(?<![#@\p{L}\p{N}])[A-Z]{3,}(?![\p{L}\p{N}])/gu)) {
    if (!allow.has(m[0])) words.push({ start: m.index!, end: m.index! + m[0].length });
  }
  const one = ({ start, end }: { start: number; end: number }): FindingDraft => {
    const quote = ctx.body.slice(start, end);
    return {
      ...base(rule), quote, start, end,
      message: `“${quote}” is written in capitals, which reads as shouting.`,
      fix_kind: "replace",
      fix_text: quote[0] + quote.slice(1).toLowerCase(),
    };
  };
  if (!ctx.pages?.length) return words.map(one);

  // Documents: neighbouring words in capitals are one phrase ("BANK CREDIT ALLOCATION"), and a deck that sets its
  // headings and labels in capitals is one finding naming the pages, not one per word.
  const phrases: { start: number; end: number }[] = [];
  for (const w of words) {
    const prev = phrases.at(-1);
    if (prev && CAPS_BETWEEN.test(ctx.body.slice(prev.end, w.start))) prev.end = w.end;
    else phrases.push({ ...w });
  }
  if (phrases.length <= 3) return phrases.map(one);
  const pages = [...new Set(phrases.map((p) => pageAt(ctx.pages!, p.start)!))].sort((a, b) => a - b);
  const first = phrases[0];
  const quote = ctx.body.slice(first.start, first.end);
  const more = phrases.length - 1;
  return [{
    ...base(rule), quote, start: first.start, end: first.end, page: pageAt(ctx.pages, first.start), ...(pages.length > 1 ? { pages } : {}),
    message: `“${quote}” and ${more} more phrase${more === 1 ? "" : "s"} on ${pageList(pages)} are written in capitals, which reads as shouting. The guide keeps capitals for the logo.`,
    fix_kind: "none",
    fix_text: `Set headings, labels and buttons in sentence case (“${quote[0] + quote.slice(1).toLowerCase()}”) in the source file, export the PDF again and upload it as a new version.`,
  }];
}

/** What may sit between two words in capitals of one phrase: spaces, punctuation, numbers and short words ("TO", "A"). */
const CAPS_BETWEEN = /^(?:[ \t&/·•:,+\-–—'’.()[\]%\d]|\b[A-Z]{1,2}\b)*$/;

/**
 * The sentence without its pressure phrases, or null when nothing worth keeping is left (e.g. "Act now.").
 * Every listed phrase is removed, so a fix never keeps a second one ("Hurry, offer ends soon" → not "Offer ends soon").
 */
export function withoutPressure(sentence: string, phrase: string | string[]): string | null {
  const phrases = Array.isArray(phrase) ? phrase : [phrase];
  let rest = sentence;
  let dontMiss = false;
  for (const p of phrases) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");
    const re = new RegExp(`\\b${esc}\\b`, "gi");
    if (re.test(rest) && /^don['’]?t miss$/i.test(p)) dontMiss = true;
    rest = rest.replace(re, "");
  }
  rest = rest.replace(/!+/g, ".").replace(/^[\s,:;–—-]+/, "").replace(/\s+([.,])/g, "$1").replace(/,\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
  if (dontMiss) rest = rest.replace(/^(?:out on\s+)?/i, "Try ");
  rest = rest.replace(/^to\s+/i, "");
  const words = rest.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  return /[.?]$/.test(rest) ? rest : `${rest}.`;
}

/** TONE-04: pressure phrases and repeated exclamation marks. */
export function pressureCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const phrases = (rule.params.phrases as string[]) ?? [];
  const maxBang = Number(rule.params.max_exclamations ?? 1);
  const out: FindingDraft[] = [];
  const coveredSentences = new Set<number>();
  const activeOffer = ctx.facts.find(
    (f) => f.unit === "%" && f.status === "approved" && f.expires_on && f.expires_on >= ctx.today && f.keywords.includes("offer"),
  );

  for (const phrase of phrases) {
    for (const m of findPhrase(ctx.body, phrase)) {
      const s = sentenceAt(ctx.body, m.start);
      if (!s || coveredSentences.has(s.start)) continue;
      coveredSentences.add(s.start);
      const aboutOffer = /offer|ends|sale|deal/i.test(s.text);
      const fix = aboutOffer && activeOffer?.expires_on ? `Offer ends ${dayMonth(activeOffer.expires_on)}.` : withoutPressure(s.text, phrases);
      out.push({
        ...base(rule),
        fact_code: aboutOffer && activeOffer ? activeOffer.code : null,
        quote: s.text,
        start: s.start,
        end: s.end,
        message: `“${m.text}” is pressure language${/!{2,}/.test(s.text) ? ", and the sentence has more than one exclamation mark" : ""}.${aboutOffer && activeOffer ? ` State the real end date instead (fact ${activeOffer.code}).` : ""}`,
        fix_kind: fix ? "replace" : "none",
        fix_text: fix ? capitaliseLike(s.text, fix) : "Remove this sentence: without the pressure phrase it says nothing.",
      });
    }
  }

  const bangs = [...ctx.body.matchAll(/!+/g)];
  const total = bangs.reduce((n, b) => n + b[0].length, 0);
  if (total > maxBang) {
    for (const b of bangs) {
      const s = sentenceAt(ctx.body, b.index!);
      if (s && coveredSentences.has(s.start)) continue;
      if (b[0].length < 2 && total - b[0].length < maxBang) continue;
      if (b[0].length < 2) continue;
      out.push({
        ...base(rule),
        quote: b[0],
        start: b.index!,
        end: b.index! + b[0].length,
        message: `${b[0].length} exclamation marks in a row. The guide allows at most ${maxBang} in a piece.`,
        fix_kind: "replace",
        fix_text: "!",
      });
    }
  }
  return out;
}

function camel(tag: string): string {
  const word = tag.replace(/^#/, "");
  return "#" + word[0].toUpperCase() + word.slice(1);
}

/** SOC-01: number of hashtags, required hashtag and CamelCase. */
export function hashtagCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const max = Number(rule.params.max ?? 3);
  const required = String(rule.params.required ?? "");
  const tags = [...ctx.body.matchAll(/#\p{L}[\p{L}\p{N}_]*/gu)].map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
  const problems: string[] = [];
  const hasRequired = required ? tags.some((t) => t.text.toLowerCase() === required.toLowerCase()) : true;
  const lowerLong = tags.filter((t) => t.text.length > 8 && t.text.slice(1) === t.text.slice(1).toLowerCase());
  if (tags.length > max) problems.push(`it has ${tags.length} hashtags (at most ${max})`);
  if (!hasRequired) problems.push(`${required} is missing`);
  if (lowerLong.length) problems.push(`${lowerLong.map((t) => t.text).join(", ")} ${lowerLong.length > 1 ? "look" : "looks"} like several words; write them in CamelCase so screen readers can read them`);
  if (!problems.length) return [];

  if (!tags.length) {
    return [{
      ...base(rule), quote: ctx.body.slice(-Math.min(ctx.body.length, 30)), start: null, end: null,
      message: `This post has no hashtags; ${required} is required.`, fix_kind: "append", fix_text: ` ${required}`,
    }];
  }
  const first = tags[0];
  const last = tags[tags.length - 1];
  const keep = tags.filter((t) => t.text.toLowerCase() !== required.toLowerCase()).slice(0, required ? max - 1 : max);
  const proposed = [...keep.map((t) => (lowerLong.includes(t) ? t.text : camel(t.text))), ...(required ? [required] : [])].join(" ");
  return [{
    ...base(rule),
    quote: ctx.body.slice(first.start, last.end),
    start: first.start,
    end: last.end,
    message: `Hashtags: ${problems.join("; ")}.`,
    fix_kind: "replace",
    fix_text: proposed,
  }];
}

/** SOC-02: too many emoji. */
export function emojiCheck(ctx: CheckContext, rule: Rule): FindingDraft[] {
  const max = Number(rule.params.max ?? 2);
  const emoji = [...ctx.body.matchAll(/\p{Extended_Pictographic}/gu)];
  if (emoji.length <= max) return [];
  const extra = emoji[max];
  return [{
    ...base(rule),
    quote: emoji.map((e) => e[0]).join(" "),
    start: extra.index!,
    end: extra.index! + extra[0].length,
    message: `This piece uses ${emoji.length} emoji; the guide allows at most ${max}.`,
    fix_kind: "none",
    fix_text: `Keep the ${max} that add the most meaning and remove the rest.`,
  }];
}
