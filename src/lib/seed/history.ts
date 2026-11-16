// Made-up review history for the fictional Urja Bites team (October to early November 2026).
// It is shown on the Insights page, always labelled "sample", so the page is useful on a first visit.
// It is never written to the database and never mixed into drafts, approvals or the audit trail.
import type { Channel } from "@/lib/checks/types";

export type SampleDecision = { action: "accept" | "dispute" | "uphold" | "override"; reason?: string; by: string };
export type SampleRecord = {
  draft: string; channel: Channel; rule_code: string; quote: string; message: string;
  label: "code" | "ai_verified" | "needs_judgment"; fact_code?: string; on: string; decisions: SampleDecision[];
};

const accept: SampleDecision[] = [{ action: "accept", by: "Arjun" }];
const r = (draft: string, channel: Channel, rule_code: string, quote: string, message: string, on: string, decisions: SampleDecision[] = accept, extra: Partial<SampleRecord> = {}): SampleRecord =>
  ({ draft, channel, rule_code, quote, message, on, decisions, label: "code", ...extra });

export const SAMPLE_HISTORY: SampleRecord[] = [
  // Pressure language keeps coming back in festive posts
  r("Navratri countdown post", "instagram", "TONE-04", "Hurry", "“Hurry” is pressure language.", "2026-10-03"),
  r("Navratri countdown post", "instagram", "TONE-04", "Last chance", "“Last chance” is pressure language.", "2026-10-03"),
  r("Dussehra offer ad", "ad", "TONE-04", "ends soon", "“ends soon” is pressure language.", "2026-10-09"),
  r("Diwali teaser reel caption", "instagram", "TONE-04", "Don't miss", "“Don't miss” is pressure language.", "2026-10-28"),
  r("Diwali email, first draft", "email", "TONE-04", "act now", "“act now” is pressure language.", "2026-10-29"),
  r("Navratri countdown post", "instagram", "TONE-03", "BIG FESTIVE SALE", "Words in capitals read as shouting.", "2026-10-03"),
  r("Dussehra offer ad", "ad", "TONE-03", "LIMITED BOXES", "Words in capitals read as shouting.", "2026-10-09"),

  // Terminology
  r("Gym partner flyer", "website", "TERM-01", "energy bar", "Use “protein bar”, not “energy bar”.", "2026-10-06"),
  r("Diwali teaser reel caption", "instagram", "TERM-01", "guilt-free", "Use “feel-good”, not “guilt-free”.", "2026-10-28"),
  r("Office snacking LinkedIn post", "linkedin", "TERM-01", "energy bar", "Use “protein bar”, not “energy bar”.", "2026-10-14"),
  r("Website FAQ refresh", "website", "TERM-01", "sugar-free", "Use “no added sugar”, not “sugar-free”.", "2026-10-21"),
  r("Diwali email, first draft", "email", "TERM-01", "Coco Crunch", "Use “Cocoa Crunch”, not “Coco Crunch”.", "2026-10-29"),

  // Claims: outdated and unsupported numbers
  r("Dussehra offer ad", "ad", "CLAIM-01", "50,000+ customers", "“50,000+ customers” conflicts with approved fact F-12: 35,000+ customers, as of Oct 2026.", "2026-10-09", accept, { fact_code: "F-12" }),
  r("Office snacking LinkedIn post", "linkedin", "CLAIM-01", "50,000+ customers", "“50,000+ customers” conflicts with approved fact F-12: 35,000+ customers, as of Oct 2026.", "2026-10-14", accept, { fact_code: "F-12" }),
  r("Diwali teaser reel caption", "instagram", "CLAIM-01", "50,000+ customers", "“50,000+ customers” conflicts with approved fact F-12: 35,000+ customers, as of Oct 2026.", "2026-10-28", accept, { fact_code: "F-12" }),
  r("Diwali email, first draft", "email", "CLAIM-01", "15% off", "“15% off” comes from an outdated fact, F-14 (ended 20 Oct).", "2026-10-29", accept, { fact_code: "F-14" }),
  r("Gym partner flyer", "website", "CLAIM-01", "dietitian recommended", "No approved fact supports “dietitian recommended”.", "2026-10-06", accept, { label: "ai_verified" }),
  r("Website FAQ refresh", "website", "CLAIM-01", "dietitian recommended", "No approved fact supports “dietitian recommended”.", "2026-10-21", accept, { label: "ai_verified" }),
  r("Office snacking LinkedIn post", "linkedin", "CLAIM-01", "stocked in 40+ offices", "No approved fact supports “stocked in 40+ offices”.", "2026-10-14", accept, { label: "ai_verified" }),
  r("Corporate gifting email", "email", "CLAIM-01", "stocked in 40+ offices", "No approved fact supports “stocked in 40+ offices”.", "2026-11-02", accept, { label: "ai_verified" }),
  r("Dussehra offer ad", "ad", "CLAIM-02", "India's #1 protein bar", "A ranking claim with no approved source.", "2026-10-09",
    [{ action: "dispute", reason: "Everyone in the office calls it number one.", by: "Arjun" }, { action: "uphold", reason: "A ranking needs an independent source. Keep it out.", by: "Ritu" }]),
  r("Diwali teaser reel caption", "instagram", "CLAIM-02", "the tastiest bar", "A superlative with no approved source.", "2026-10-28"),
  r("Website FAQ refresh", "website", "CLAIM-03", "boosts immunity", "A health claim. The guide forbids these.", "2026-10-21",
    [{ action: "dispute", reason: "Peanuts have zinc, so it does help immunity.", by: "Arjun" }, { action: "uphold", reason: "Still a health claim under FSSAI rules. Not allowed.", by: "Ritu" }]),
  r("Dussehra offer ad", "ad", "DISC-01", "Flat 15% off this Dussehra.", "Mentions an offer but does not say “T&C apply”.", "2026-10-09"),
  r("Diwali email, first draft", "email", "DISC-01", "Diwali boxes at 20% off.", "Mentions an offer but does not say “T&C apply”.", "2026-10-29"),
  r("Corporate gifting email", "email", "DISC-01", "10% off orders above 50 boxes.", "Mentions an offer but does not say “T&C apply”.", "2026-11-02"),

  // Messaging: "taste first" keeps being argued about on LinkedIn and email
  r("Gym partner flyer", "website", "MSG-01", "Packed with 12 g of protein.", "Opens with protein rather than taste.", "2026-10-06",
    [{ action: "dispute", reason: "This flyer is for gym owners. Protein is the reason they stock us.", by: "Arjun" }, { action: "override", reason: "Fair: for gym partners the protein figure can lead.", by: "Meera" }], { label: "ai_verified" }),
  r("Office snacking LinkedIn post", "linkedin", "MSG-01", "12 g of protein for your 4 pm slump.", "Opens with protein rather than taste.", "2026-10-14",
    [{ action: "dispute", reason: "On LinkedIn the audience is HR buyers. They ask about protein first.", by: "Arjun" }, { action: "override", reason: "Agree, B2B posts can lead with the benefit.", by: "Meera" }], { label: "ai_verified" }),
  r("Corporate gifting email", "email", "MSG-01", "Each box has 12 g of protein per bar.", "Opens with protein rather than taste.", "2026-11-02",
    [{ action: "dispute", reason: "The rule doesn't say if it applies to sales emails to companies.", by: "Arjun" }], { label: "needs_judgment" }),
  r("Diwali teaser reel caption", "instagram", "MSG-01", "Protein that tastes like Diwali.", "Opens with protein rather than taste.", "2026-10-28", accept, { label: "ai_verified" }),
  r("Navratri countdown post", "instagram", "MSG-01", "Your 12 g protein fix.", "Opens with protein rather than taste.", "2026-10-03", accept, { label: "ai_verified" }),

  r("Office snacking LinkedIn post", "linkedin", "MSG-02", "Order now, follow us and tag a colleague.", "Three calls to action in one post.", "2026-10-14", accept, { label: "ai_verified" }),
  r("Navratri countdown post", "instagram", "SOC-01", "#protein #snack #healthy #fitness #navratri #festive", "Six hashtags; the limit is three.", "2026-10-03"),
  r("Diwali teaser reel caption", "instagram", "SOC-01", "#diwali #gifting #protein #festive #urjabites", "Five hashtags; the limit is three.", "2026-10-28"),

  // Visual and accessibility
  r("Diwali teaser reel caption", "instagram", "VIS-02", "Background #D4AF37", "Gold is not in the brand palette.", "2026-10-28",
    [{ action: "dispute", reason: "Festive gold agreed with Kabir for Diwali only.", by: "Arjun" }, { action: "override", reason: "Approved one-off for the Diwali campaign.", by: "Kabir" }], { label: "needs_judgment" }),
  r("Dussehra offer ad", "ad", "A11Y-01", "(no alt text)", "Images need alt text.", "2026-10-09"),
  r("Gym partner flyer", "website", "A11Y-01", "(no alt text)", "Images need alt text.", "2026-10-06"),
  r("Navratri countdown post", "instagram", "A11Y-01", "(no alt text)", "Images need alt text.", "2026-10-03"),
  r("Website FAQ refresh", "website", "TONE-02", "Our bars, which are made with dates, cocoa and roasted peanuts that we source from farmers in Maharashtra and Karnataka, give you…", "This sentence is 31 words; the limit is 25.", "2026-10-21"),
];
