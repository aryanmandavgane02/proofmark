import { describe, expect, it } from "vitest";
import { runCodeChecks } from "./index";
import { allCapsCheck, emojiCheck, glossaryCheck, hashtagCheck, pressureCheck, readabilityCheck, withoutPressure } from "./style";
import { absolutesCheck, disclaimerCheck, extractNumberClaims, factsCheck, healthClaimsCheck, superlativesCheck } from "./claims";
import { altTextCheck } from "./accessibility";
import { sentences, findPhrase, formatIndian, dayMonth } from "./text";
import { seedContext, seedRules } from "@/lib/seed/context";
import { SAMPLE_DRAFTS } from "@/lib/seed/urja";
import type { Channel, Rule } from "./types";

const rule = (code: string): Rule => seedRules().find((r) => r.code === code)!;
const ctx = (body: string, channel: Channel = "linkedin", alt_text = "") => seedContext({ body, channel, alt_text });

describe("text helpers", () => {
  it("splits sentences with exact positions", () => {
    const t = "One. Two two!  Three?";
    const s = sentences(t);
    expect(s.map((x) => x.text)).toEqual(["One.", "Two two!", "Three?"]);
    for (const x of s) expect(t.slice(x.start, x.end)).toBe(x.text);
  });
  it("treats line breaks as sentence ends", () => {
    expect(sentences("Subject: hello\nBody here.").map((s) => s.text)).toEqual(["Subject: hello", "Body here."]);
  });
  it("finds whole phrases only", () => {
    expect(findPhrase("cheapest and cheap", "cheap").map((m) => m.start)).toEqual([13]);
  });
  it("formats Indian numbers and dates", () => {
    expect(formatIndian(35000)).toBe("35,000");
    expect(formatIndian(150000)).toBe("1,50,000");
    expect(dayMonth("2026-11-30")).toBe("30 November");
  });
});

describe("TERM-01 glossary", () => {
  it("flags words to avoid and suggests the preferred term", () => {
    const f = glossaryCheck(ctx("Our sugar-free bar is a guilt-free treat."), rule("TERM-01"));
    expect(f.map((x) => x.quote)).toEqual(["sugar-free", "guilt-free"]);
    expect(f[0].fix_text).toBe("no added sugar");
  });
  it("keeps sentence-start capitals in the fix", () => {
    expect(glossaryCheck(ctx("Sugar-free and tasty."), rule("TERM-01"))[0].fix_text).toBe("No added sugar");
  });
  it("is case-sensitive for the brand name", () => {
    expect(glossaryCheck(ctx("Love Urja bites!"), rule("TERM-01"))[0].fix_text).toBe("Urja Bites");
    expect(glossaryCheck(ctx("Love Urja Bites."), rule("TERM-01"))).toHaveLength(0);
  });
  it("ignores the brand hashtag", () => {
    expect(glossaryCheck(ctx("Try it #UrjaBites"), rule("TERM-01"))).toHaveLength(0);
  });
  it("gives exact positions", () => {
    const body = "A cheap snack.";
    const [f] = glossaryCheck(ctx(body), rule("TERM-01"));
    expect(body.slice(f.start!, f.end!)).toBe("cheap");
  });
});

describe("TONE checks", () => {
  it("TONE-02 flags long sentences only", () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") + ".";
    expect(readabilityCheck(ctx(`Short one. ${long}`), rule("TONE-02"))).toHaveLength(1);
    expect(readabilityCheck(ctx("Short one. Another short one."), rule("TONE-02"))).toHaveLength(0);
  });
  it("TONE-03 flags shouting but allows listed acronyms and codes", () => {
    const f = allCapsCheck(ctx("This is AMAZING. Pay by UPI with code URJA15. T&C apply."), rule("TONE-03"));
    expect(f.map((x) => x.quote)).toEqual(["AMAZING"]);
    expect(f[0].fix_text).toBe("Amazing");
  });
  it("TONE-03 in a document: a phrase in capitals is one finding, and a deck in capitals is one finding naming its pages", () => {
    const doc = (texts: string[]) => {
      let body = "";
      const pages = texts.map((t, i) => {
        if (i) body += "\n\n";
        const start = body.length;
        body += t;
        return { n: i + 1, start, end: body.length, fonts: [], runs: [] };
      });
      return seedContext({ body, channel: "document", pages });
    };
    const few = allCapsCheck(doc(["BANK CREDIT ALLOCATION & DEFAULT RISK\nPlain words here."]), rule("TONE-03"));
    expect(few.map((f) => [f.quote, f.fix_text])).toEqual([["BANK CREDIT ALLOCATION & DEFAULT RISK", "Bank credit allocation & default risk"]]);
    const many = allCapsCheck(doc(["OPTIMISATION PROJECT PROPOSAL\nTEAM: ARYAN • VINAY\nGOAL: MAXIMISE PROFIT SUBJECT TO A CAPITAL BUDGET", "PROBLEM MOTIVATION\nAPPROVE EVERYONE\nSome plain text."]), rule("TONE-03"));
    expect(many).toHaveLength(1);
    expect(many[0]).toMatchObject({ quote: "OPTIMISATION PROJECT PROPOSAL", page: 1, pages: [1, 2], fix_kind: "none" });
    expect(many[0].message).toContain("and 4 more phrases on pages 1 and 2");
  });
  it("TONE-04 rewrites pressure language using the live offer's end date", () => {
    const [f] = pressureCheck(ctx("Great bars. Hurry, offer ends soon!!!"), rule("TONE-04"));
    expect(f.quote).toBe("Hurry, offer ends soon!!!");
    expect(f.fix_text).toBe("Offer ends 30 November.");
    expect(f.fact_code).toBe("F-13");
  });
  it("TONE-04 fixes read naturally, and a sentence that is only pressure is removed, not replaced with a dot", () => {
    expect(withoutPressure("Last chance to try the Diwali box.", "last chance")).toBe("try the Diwali box.");
    expect(withoutPressure("Hurry, our Cocoa Crunch bars are back!", "hurry")).toBe("our Cocoa Crunch bars are back.");
    expect(withoutPressure("Don't miss our new Peanut Power bar.", "don't miss")).toBe("Try our new Peanut Power bar.");
    expect(withoutPressure("Act now.", "act now")).toBeNull();
    const [f] = pressureCheck(ctx("Great bars for your desk. Act now."), rule("TONE-04"));
    expect(f).toMatchObject({ quote: "Act now.", fix_kind: "none" });
    expect(pressureCheck(ctx("Last chance to try the Diwali box."), rule("TONE-04"))[0].fix_text).toBe("Try the Diwali box.");
    // Every pressure phrase is removed, so a fix never keeps a second one, even when no offer is live (after 30 Nov)
    const phrases = rule("TONE-04").params.phrases as string[];
    expect(withoutPressure("Hurry, offer ends soon!!!", phrases)).toBeNull();
    expect(withoutPressure("Hurry, last chance to grab our Cocoa Crunch box.", phrases)).toBe("grab our Cocoa Crunch box.");
    expect(pressureCheck({ ...ctx("Great bars. Hurry, offer ends soon!!!"), today: "2026-12-01" }, rule("TONE-04"))[0].fix_kind).toBe("none");
  });
  it("TONE-04 flags repeated exclamation marks", () => {
    const f = pressureCheck(ctx("So tasty!!"), rule("TONE-04"));
    expect(f).toHaveLength(1);
    expect(f[0].fix_text).toBe("!");
  });
  it("TONE-04 allows a single exclamation mark", () => {
    expect(pressureCheck(ctx("So tasty!"), rule("TONE-04"))).toHaveLength(0);
  });
});

describe("SOC checks", () => {
  it("SOC-01 reports count, missing brand tag and casing in one finding", () => {
    const [f] = hashtagCheck(ctx("Snack time #protein #fitness #healthysnacks #diwali", "instagram"), rule("SOC-01"));
    expect(f.message).toMatch(/4 hashtags/);
    expect(f.message).toMatch(/#UrjaBites is missing/);
    expect(f.message).toMatch(/#healthysnacks/);
    expect(f.fix_text).toBe("#Protein #Fitness #UrjaBites");
  });
  it("SOC-01 does not treat #1 as a hashtag", () => {
    expect(hashtagCheck(ctx("India's #1 snack #UrjaBites", "instagram"), rule("SOC-01"))).toHaveLength(0);
  });
  it("SOC-01 passes a compliant set", () => {
    expect(hashtagCheck(ctx("Hi #UrjaBites #MadeInIndia", "instagram"), rule("SOC-01"))).toHaveLength(0);
  });
  it("SOC-02 flags more than two emoji", () => {
    expect(emojiCheck(ctx("Yum 🍫🔥💪", "instagram"), rule("SOC-02"))).toHaveLength(1);
    expect(emojiCheck(ctx("Yum 🍫🔥", "instagram"), rule("SOC-02"))).toHaveLength(0);
  });
});

describe("claims", () => {
  it("extracts number claims with units", () => {
    const c = extractNumberClaims("Trusted by 50,000+ gym-goers. 20% off. Only ₹499. 15 g of protein. Rated 4.8/5.");
    expect(c.map((x) => [x.unit, x.value])).toEqual([["count", 50000], ["%", 20], ["inr", 499], ["g", 15], ["rating", 4.8]]);
  });
  it("parses k and lakh", () => {
    expect(extractNumberClaims("Loved by 40k fans")[0].value).toBe(40000);
    expect(extractNumberClaims("Over 1 lakh customers")[0].value).toBe(100000);
  });
  it("CLAIM-01 flags a count above the approved fact and suggests the fact", () => {
    const [f] = factsCheck(ctx("Trusted by 50,000+ gym-goers."), rule("CLAIM-01"));
    expect(f.fact_code).toBe("F-12");
    expect(f.fix_text).toBe("35,000+ customers");
  });
  it("CLAIM-01 accepts a count at or below the fact", () => {
    expect(factsCheck(ctx("We just crossed 35,000 customers."), rule("CLAIM-01"))).toHaveLength(0);
    expect(factsCheck(ctx("Over 30,000 customers love it."), rule("CLAIM-01"))).toHaveLength(0);
  });
  it("CLAIM-01 catches an expired offer and points to the current one", () => {
    const [f] = factsCheck(ctx("Get 15% off this week."), rule("CLAIM-01"));
    expect(f.fact_code).toBe("F-14");
    expect(f.message).toMatch(/outdated/);
    expect(f.fix_text).toBe("20% off");
  });
  it("CLAIM-01 accepts the current offer", () => {
    expect(factsCheck(ctx("Get 20% off the 6-bar box."), rule("CLAIM-01"))).toHaveLength(0);
  });
  it("CLAIM-01 ignores percentages that are not offers", () => {
    expect(factsCheck(ctx("Made with 100% natural cocoa."), rule("CLAIM-01"))).toHaveLength(0);
  });
  it("CLAIM-01 checks protein grams and prices", () => {
    expect(factsCheck(ctx("Packed with 15 g of protein."), rule("CLAIM-01"))[0].fix_text).toBe("12 g of protein");
    expect(factsCheck(ctx("A box costs ₹499."), rule("CLAIM-01"))[0].fix_text).toBe("₹540");
    expect(factsCheck(ctx("A box costs ₹540."), rule("CLAIM-01"))).toHaveLength(0);
  });
  it("CLAIM-01 flags a rating that does not match", () => {
    expect(factsCheck(ctx("Rated 4.9 stars by buyers."), rule("CLAIM-01"))[0].fact_code).toBe("F-16");
  });
  it("CLAIM-02 flags superlatives and proposes a fact-based line", () => {
    const [f] = superlativesCheck(ctx("India's #1 protein bar, now in Pune."), rule("CLAIM-02"));
    expect(f.severity).toBe("blocker");
    expect(f.fix_text).toBe("The protein bar 35,000+ customers trust");
  });
  it("DISC-01 finds offer words as words: not inside \"ideal\", \"dealing\" or \"wholesale\"", () => {
    expect(disclaimerCheck(ctx("The ideal snack for dealing with hunger. Wholesale packs on request."), rule("DISC-01"))).toHaveLength(0);
    expect(disclaimerCheck(ctx("How to deal with a 4 pm slump."), rule("DISC-01"))).toHaveLength(0);
    expect(disclaimerCheck(ctx("Best deals this week on the gift box."), rule("DISC-01"))[0].message).toContain("“deals”");
    expect(disclaimerCheck(ctx("Get 20% off the 6-bar box."), rule("DISC-01"))[0].message).toContain("“% off”");
    expect(disclaimerCheck(ctx("Discounted boxes for Diwali."), rule("DISC-01"))).toHaveLength(1);
  });
  it("CLAIM-02 ignores numbering and code, and keeps the quote on its line", () => {
    for (const t of ["Order #1, #2, #3, … all kept.", "Step #1: open the box.", "1: invokespecial #1 // Method java/lang/Object", "Entry #13 is the name."]) {
      expect(superlativesCheck(ctx(t), rule("CLAIM-02")), t).toHaveLength(0);
    }
    expect(superlativesCheck(ctx("Rated #1 by snackers."), rule("CLAIM-02"))).toHaveLength(1);
    expect(superlativesCheck(ctx("One clean calculation, exact best answer\nTHINK OF IT AS"), rule("CLAIM-02"))[0].quote).toBe("best answer");
    expect(superlativesCheck(ctx("Harder search, best answer we can find."), rule("CLAIM-02"))[0].quote).toBe("best answer");
  });
  it("CLAIM-02 stops the product name at small words", () => {
    expect(superlativesCheck(ctx("The best bar in India."), rule("CLAIM-02"))[0].fix_text).toBe("The bar 35,000+ customers trust");
  });
  it("CLAIM-02 leaves ordinary words alone", () => {
    expect(superlativesCheck(ctx("Our most-loved flavour is back."), rule("CLAIM-02"))).toHaveLength(0);
  });
  it("CLAIM-03 flags health claims but not the word treat", () => {
    const f = healthClaimsCheck(ctx("It cures fatigue and boosts immunity. A tasty treat."), rule("CLAIM-03"));
    expect(f.map((x) => x.quote)).toEqual(["cures", "boosts immunity"]);
  });
  it("ADV-01 flags guarantees", () => {
    const [f] = absolutesCheck(ctx("It is 100% guaranteed to keep you full."), rule("ADV-01"));
    expect(f.quote).toBe("100% guaranteed to");
    expect(f.fix_text).toBe("made to");
  });
  it("DISC-01 asks for T&C on the actual offer sentence", () => {
    const [f] = disclaimerCheck(ctx("Hurry, offer ends soon. Grab 20% off this Diwali."), rule("DISC-01"));
    expect(f.quote).toBe("Grab 20% off this Diwali.");
    expect(f.fix_text).toBe("Grab 20% off this Diwali. T&C apply.");
  });
  it("DISC-01 is satisfied when T&C is present", () => {
    expect(disclaimerCheck(ctx("Grab 20% off. T&C apply."), rule("DISC-01"))).toHaveLength(0);
  });
});

describe("A11Y-01 alt text", () => {
  it("requires alt text on visual channels", () => {
    expect(altTextCheck(ctx("Hi", "instagram", ""), rule("A11Y-01"))[0].field).toBe("alt_text");
  });
  it("does not require it for email without an image", () => {
    expect(altTextCheck(ctx("Hi", "email", ""), rule("A11Y-01"))).toHaveLength(0);
  });
  it("rewrites 'image of' openings", () => {
    const [f] = altTextCheck(ctx("Hi", "instagram", "Image of two bars on a plate"), rule("A11Y-01"));
    expect(f.fix_text).toBe("Two bars on a plate");
  });
  it("accepts a good description", () => {
    expect(altTextCheck(ctx("Hi", "instagram", "Two Urja Bites bars on a cream plate"), rule("A11Y-01"))).toHaveLength(0);
  });
});

describe("whole pipeline on the sample drafts", () => {
  const run = (key: string) => {
    const d = SAMPLE_DRAFTS.find((s) => s.key === key)!;
    return runCodeChecks(seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel }));
  };
  it("the clean control has no findings", () => {
    expect(run("website")).toHaveLength(0);
  });
  it("the Diwali post finds issues in claims, tone, messaging and accessibility", () => {
    const cats = new Set(run("diwali-post").map((f) => f.category));
    expect([...cats].sort()).toEqual(["accessibility", "claims", "messaging", "tone"]);
  });
  it("the newsletter finds the expired offer, the wrong protein figure and the health claims", () => {
    const codes = run("newsletter").map((f) => `${f.rule_code}${f.fact_code ? "/" + f.fact_code : ""}`);
    expect(codes).toEqual(expect.arrayContaining(["CLAIM-01/F-14", "CLAIM-01/F-10", "CLAIM-03", "ADV-01", "DISC-01", "TONE-02"]));
  });
  it("blockers come first", () => {
    const sev = run("newsletter").map((f) => f.severity);
    expect(sev.indexOf("minor")).toBeGreaterThan(sev.lastIndexOf("blocker"));
  });
  it("every finding's offsets match its quote", () => {
    for (const d of SAMPLE_DRAFTS) {
      for (const f of runCodeChecks(seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel }))) {
        if (f.field === "body" && f.start != null) expect(d.body.slice(f.start, f.end!)).toBe(f.quote);
      }
    }
  });
  it("every finding has a rule and a suggested correction", () => {
    for (const d of SAMPLE_DRAFTS) {
      for (const f of runCodeChecks(seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel }))) {
        expect(f.rule_code).toBeTruthy();
        expect(f.fix_text).toBeTruthy();
      }
    }
  });
  it("rules outside their channel do not run", () => {
    expect(runCodeChecks(ctx("Hi #a #b #c #d #e", "email")).some((f) => f.rule_code === "SOC-01")).toBe(false);
  });
  it("is deterministic", () => {
    expect(run("diwali-post")).toEqual(run("diwali-post"));
  });
});

describe("reading level per channel (TONE-02)", () => {
  const avgFindings = (body: string, channel: "ad" | "website" | "instagram") =>
    runCodeChecks(seedContext({ body, channel, alt_text: "A Cocoa Crunch bar on a cream plate." })).filter((f) => f.rule_code === "TONE-02");
  it("flags an ad whose sentences are long on average, quoting the longest", () => {
    const body = "Roasted cocoa, crunchy peanuts and dates come together in one honest bar for busy afternoons. Try a box of six from our Pune kitchen at urjabites.in today.";
    const f = avgFindings(body, "ad");
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/average \d+ words; for advertisement the guide asks for 12 or fewer/);
    expect(f[0].quote).toBe("Roasted cocoa, crunchy peanuts and dates come together in one honest bar for busy afternoons.");
  });
  it("allows the same text on the website, where sentences may be longer", () => {
    expect(avgFindings("Roasted cocoa, crunchy peanuts and dates come together in one honest bar for busy afternoons. Try a box of six from our Pune kitchen at urjabites.in today.", "website")).toEqual([]);
  });
  it("does not flag a sentence twice when it is already too long", () => {
    const long = "Our bars, which are made with roasted cocoa and dates and peanuts that we buy from small farms and roast in our own kitchen every single morning, are great.";
    expect(avgFindings(long, "instagram")).toHaveLength(1);
  });
});

describe("sentences", () => {
  it("does not end a sentence inside a web address or a decimal", async () => {
    const { sentences } = await import("./text");
    expect(sentences("Rated 4.6 out of 5. Order at urjabites.in today. Done!").map((s) => s.text)).toEqual(["Rated 4.6 out of 5.", "Order at urjabites.in today.", "Done!"]);
  });
});
