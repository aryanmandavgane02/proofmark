import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { factChange, factPhrases, mentionsOf, quotesOf, reliance } from "./alerts";
import { runCodeChecks } from "@/lib/checks";
import { readPdf } from "@/lib/documents/read";
import { seedContext, seedFacts } from "@/lib/seed/context";
import { LIBRARY, LIBRARY_DECK } from "@/lib/seed/library";
import type { DocPage } from "@/lib/checks/types";

const facts = seedFacts();
const fact = (code: string) => facts.find((f) => f.code === code)!;
const pagesOf = (key: string) => (LIBRARY.find((i) => i.key === key)?.document ? (LIBRARY_DECK.pages as DocPage[]) : undefined);
const dependents = (code: string, how: "value" | "any") =>
  LIBRARY.filter((i) => reliance(fact(code), i.body, pagesOf(i.key), facts, how).length > 0).map((i) => i.key).sort();

describe("which approved content relies on a fact", () => {
  it("finds every form of the customer count, and no decoy", () => {
    expect(dependents("F-12", "value")).toEqual(["lib-about", "lib-deck", "lib-milestone", "lib-thanks", "lib-welcome"]);
  });
  it("finds the offer in the drafts that quote it", () => {
    expect(dependents("F-13", "any")).toEqual(["lib-deck", "lib-diwali-email", "lib-diwali-post"]);
    expect(dependents("F-14", "any")).toEqual(["lib-dussehra"]);
  });
  it("matches the hand labels for every fact and every sample", () => {
    for (const f of facts.filter((x) => !x.restricted)) {
      const expected = LIBRARY.filter((i) => i.relies.includes(f.code)).map((i) => i.key).sort();
      expect(dependents(f.code, "any"), f.code).toEqual(expected);
    }
  });
  it("reads each phrasing of a number, and leaves numbers that belong elsewhere", () => {
    const f12 = fact("F-12");
    const yes = ["Loved by 35,000+ customers.", "35k customers and counting!", "You join over 35,000 happy customers.", "We crossed 35,000 families.", "35K fans can't be wrong.", "Trusted by 30,000+ gym-goers."];
    const no = ["Rated 4.6 out of 5 by 1,200 buyers.", "Our kitchen bakes 3,500 bars a day.", "Join 350 people at our tasting.", "35 years of family recipes.", "Each bar has 12 g of protein."];
    for (const t of yes) expect(quotesOf(f12, t, undefined, facts).length, t).toBe(1);
    for (const t of no) expect(quotesOf(f12, t, undefined, facts).length, t).toBe(0);
  });
  it("gives the page of each quote in a document", () => {
    const ev = quotesOf(fact("F-12"), LIBRARY_DECK.body, LIBRARY_DECK.pages as DocPage[], facts);
    expect(ev.map((e) => [e.page, e.quote])).toEqual([[2, "35,000+ customers"], [5, "35,000+ customers"]]);
  });
  it("names a text fact by its keywords or its own phrases, not by one common word", () => {
    expect(factPhrases(fact("F-11"))).toContain("no added sugar");
    expect(mentionsOf(fact("F-11"), "Each bar has 12 g of protein and no added sugar.", undefined)).toHaveLength(1);
    expect(mentionsOf(fact("F-11"), "Roasted cocoa and dates in every bar.", undefined)).toHaveLength(0);
    expect(mentionsOf(fact("F-17"), "Find it in Bengaluru, Pune and Mumbai.", undefined)).toHaveLength(1);
    expect(mentionsOf(fact("F-17"), "Our Pune kitchen bakes bars.", undefined)).toHaveLength(0);
  });
});

describe("what a fact edit means", () => {
  const f12 = { ...fact("F-12"), expires_on: null };
  it("raises alerts when a number changes, not when only its wording does", () => {
    expect(factChange(f12, { ...f12, value: 30000 }).alerts).toBe(true);
    expect(factChange(f12, { ...f12, statement: "35,000+ customers, as of Nov 2026." }).alerts).toBe(false);
  });
  it("raises alerts when a text fact's wording changes", () => {
    const f17 = { ...fact("F-17"), expires_on: null };
    expect(factChange(f17, { ...f17, statement: "Available in Bengaluru, Pune, Mumbai and Delhi." }).alerts).toBe(true);
  });
  it("notices a new or changed expiry date", () => {
    const f13 = { ...fact("F-13"), expires_on: "2026-11-30" };
    expect(factChange(f13, { ...f13, expires_on: "2026-11-25" }).expiryChanged).toBe(true);
    expect(factChange(f13, { ...f13 }).expiryChanged).toBe(false);
  });
});

describe("the sample library", () => {
  it("was clean when it was approved: no code check finds anything", () => {
    for (const item of LIBRARY) {
      // As the facts were on the day it was approved (the Dussehra offer was still running on 2 October).
      const ctx = seedContext({ body: item.body, alt_text: item.alt_text, channel: item.channel, today: item.approved_on, pages: item.document ? (LIBRARY_DECK.pages as DocPage[]) : undefined });
      ctx.facts = ctx.facts.map((f) => (f.code === "F-14" && item.approved_on <= "2026-10-20" ? { ...f, status: "approved" } : f));
      ctx.typefaces = [{ name: "Poppins", note: "Headlines" }, { name: "Inter", note: "Body text" }];
      expect(runCodeChecks(ctx).map((f) => `${f.rule_code} ${f.quote}`), item.key).toEqual([]);
    }
  });
  it("holds the exact text and pages of the approved deck file", async () => {
    const bytes = new Uint8Array(readFileSync(`public${LIBRARY_DECK.file}`));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(LIBRARY_DECK.hash);
    const doc = await readPdf(bytes);
    expect(doc.body).toBe(LIBRARY_DECK.body);
    expect(doc.pages).toEqual(LIBRARY_DECK.pages);
  });
});

describe("forms found by the held-out set", () => {
  it("reads counts written with words, Hinglish multipliers and more words for people", async () => {
    const { extractNumberClaims, wordsToNumber } = await import("@/lib/checks/claims");
    expect(wordsToNumber("thirty-five thousand")).toBe(35000);
    expect(wordsToNumber("one lakh")).toBe(100000);
    expect(wordsToNumber("twelve hundred")).toBe(1200);
    expect(wordsToNumber("lots")).toBeNaN();
    const one = (t: string) => extractNumberClaims(t).map((c) => [c.unit, c.value]);
    expect(one("35 hazaar+ logon ka bharosa")).toEqual([["count", 35000]]);
    expect(one("Join 35,000+ Indians today.")).toEqual([["count", 35000]]);
    expect(one("35 thousand shoppers")).toEqual([["count", 35000]]);
    expect(one("Thirty-five thousand customers and counting")).toEqual([["count", 35000]]);
    expect(one("4.6★ from 1.2K reviews")).toEqual([["rating", 4.6]]);
    expect(one("Everyone loves it")).toEqual([]);
  });
  it("counts a sale as this offer only when the text names the offer or its end date", () => {
    const f13 = fact("F-13");
    expect(quotesOf(f13, "Black Friday drop: flat 20% off sitewide, 27–29 Nov only.", undefined, facts)).toHaveLength(0);
    expect(quotesOf(f13, "Diwali dhamaka! Flat 20% off on our 6-bar box.", undefined, facts)).toHaveLength(1);
    expect(quotesOf(f13, "Flat 20% off the 6-bar box till 30th Nov.", undefined, facts)).toHaveLength(1);
    expect(quotesOf(fact("F-14"), "Get 15% off your first order with code HELLO15.", undefined, facts)).toHaveLength(0);
  });
  it("finds an offer named by its end date, and a price worked out from it", () => {
    expect(mentionsOf(fact("F-13"), "Festive offer still live, but only till Nov 30!", undefined)).toHaveLength(1);
    expect(mentionsOf(fact("F-13"), "Our festive offer is live!", undefined)).toHaveLength(0);
    expect(quotesOf(fact("F-13"), "Diwali price: just ₹432 for the 6-bar box.", undefined, facts).map((e) => e.quote)).toEqual(["₹432"]);
    expect(quotesOf(fact("F-15"), "Diwali price: just ₹432 for the 6-bar box.", undefined, facts)).toHaveLength(1);
  });
});
