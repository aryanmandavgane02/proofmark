// The fictional Urja Bites brand guide, page by page. Each rule's source quote is inserted verbatim
// on the page it cites, so the PDF and the rulebook can never disagree. Used by scripts/make-brand-guide.ts.
import { FACTS, PALETTE, RULES, TERMS } from "./urja";

export type GuidePage = { title: string; blocks: string[] };

const q = (code: string) => {
  const r = RULES.find((x) => x.code === code);
  if (!r) throw new Error(`No rule ${code}`);
  return r.source_quote;
};

export function guidePages(): GuidePage[] {
  const pages: Record<number, GuidePage> = {
    1: { title: "Urja Bites Brand Guide", blocks: ["Version 1, 2026. For everyone who writes, designs or approves Urja Bites content: our team, our agencies and freelancers.", "Urja Bites is a fictional snack brand created for the Proofmark demo. All names, facts and figures in this guide are made up."] },
    2: { title: "Contents", blocks: ["1 Cover · 3 Who we are · 4 Words we use · 5 Logo · 6 Colour · 7 Type · 8 Voice · 9 Tone in practice · 10 Messaging · 11 Social media · 12 Photography · 13 Email · 14 Claims and numbers · 15 Health claims and offers · 16 Who to ask"] },
    3: { title: "Who we are", blocks: ["Urja Bites makes protein bars from real ingredients: cocoa, peanuts, dates and spices. We started in a Pune kitchen and now sell in Bengaluru, Pune and Mumbai.", "We want snacking to feel good, never like a chore or a punishment."] },
    4: {
      title: "Words we use",
      blocks: [q("TERM-01"), ...TERMS.map((t) => `Use “${t.preferred}”, not ${t.avoid.map((a) => `“${a}”`).join(", ")}. ${t.reason}`)],
    },
    5: { title: "Logo", blocks: [q("VIS-01"), "Keep clear space around the logo equal to the height of the letter U. The minimum width is 80 pixels on screen."] },
    6: { title: "Colour", blocks: [q("VIS-02"), ...PALETTE.map((p) => `${p.name} ${p.hex}: ${p.note}`)] },
    7: { title: "Type", blocks: ["Headlines use a bold sans-serif. Body text uses a regular sans-serif at 16 pixels or larger on screen."] },
    8: { title: "Voice", blocks: [q("TONE-01"), q("TONE-02")] },
    9: { title: "Tone in practice", blocks: [q("TONE-03"), q("TONE-04"), "Instead of “Hurry, offer ends soon!!!” write “Offer ends 30 November.”"] },
    10: { title: "Messaging", blocks: [q("MSG-01"), q("MSG-02")] },
    11: { title: "Social media", blocks: [q("SOC-01"), q("SOC-02")] },
    12: { title: "Photography", blocks: ["Show real food in daylight. Avoid filters that change the colour of the bars."] },
    13: { title: "Email", blocks: ["Keep subject lines under 50 characters. Every email has one link button for its call to action."] },
    14: {
      title: "Claims and numbers",
      blocks: [q("CLAIM-01"), q("CLAIM-02"), "Current approved facts are kept in the fact sheet by their owners, for example:", ...FACTS.filter((f) => !f.restricted && f.status !== "expired").slice(0, 4).map((f) => `${f.code}: ${f.statement}`)],
    },
    15: { title: "Health claims and offers", blocks: [q("CLAIM-03"), q("DISC-01")] },
    16: { title: "Who to ask", blocks: ["Brand questions: Meera, brand manager. Legal and claims: Ritu. Design: Kabir."] },
  };
  return Array.from({ length: 16 }, (_, i) => pages[i + 1]);
}

/** A short update document used to demo importing new rules into an existing rulebook. */
export const GUIDE_UPDATE: GuidePage[] = [
  {
    title: "Guideline update, November 2026",
    blocks: [
      "This update adds four rules to the Urja Bites Brand Guide. They apply from 20 November 2026.",
      "Paid partnerships: every influencer or paid post must say “Paid partnership” or #ad in its first line.",
      "Competitors: never name another snack brand or compare our bars with a named competitor.",
    ],
  },
  {
    title: "Guideline update, page 2",
    blocks: [
      "Indian number style: write large numbers the Indian way, for example 1 lakh rather than 100,000.",
      "Festivals: festive posts must not show or mention firecrackers. Celebrate with lights, food and family instead.",
      "Questions about this update go to Meera, brand manager.",
    ],
  },
];
