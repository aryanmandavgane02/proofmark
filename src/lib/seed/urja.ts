// Fictional demo brand "Urja Bites" (protein snacks). Every rule quotes the brand guide,
// which is generated from this same data, so quotes and page numbers always match.

export const BRAND_GUIDE = "Urja Bites Brand Guide v1 (2026)";

export type SeedPerson = { key: "arjun" | "meera" | "ritu" | "kabir"; name: string; title: string; role: "creator" | "manager" | "reviewer"; reviewer_area?: "legal" | "design" };

export const PEOPLE: SeedPerson[] = [
  { key: "arjun", name: "Arjun", title: "Designer at Pixel & Chai (agency)", role: "creator" },
  { key: "meera", name: "Meera", title: "Brand manager", role: "manager" },
  { key: "ritu", name: "Ritu", title: "Legal and compliance", role: "reviewer", reviewer_area: "legal" },
  { key: "kabir", name: "Kabir", title: "Design lead", role: "reviewer", reviewer_area: "design" },
];

export type SeedRule = {
  code: string;
  category: "tone" | "terminology" | "messaging" | "visual" | "accessibility" | "claims";
  title: string;
  statement: string;
  severity: "blocker" | "major" | "minor";
  channels?: string[];
  check_kind: "code" | "ai" | "both";
  check_type?: string;
  params?: Record<string, unknown>;
  source_doc?: string;
  source_page?: number;
  source_quote: string;
  examples?: { bad: string; good: string }[];
  builtin?: boolean;
};

export const RULES: SeedRule[] = [
  // Tone (guide pages 8–9)
  {
    code: "TONE-01", category: "tone", title: "Warm, never preachy", severity: "minor", check_kind: "ai",
    statement: "Sound warm and encouraging. Never guilt people about food or their bodies.",
    source_page: 8, source_quote: "We sound like a friend who loves food: warm, encouraging and never preachy. We never make people feel guilty about what they eat.",
    examples: [{ bad: "Stop ruining your diet with junk.", good: "A snack that keeps up with your day." }],
  },
  {
    code: "TONE-02", category: "tone", title: "Plain, short sentences", severity: "minor", check_kind: "code", check_type: "readability",
    params: { max_sentence_words: 25, max_avg_words: { instagram: 14, linkedin: 20, email: 18, website: 18, ad: 12, document: 20 } },
    statement: "Use plain words and keep sentences short.",
    source_page: 8, source_quote: "Use plain words and short sentences. If a sentence needs a second breath, split it.",
  },
  {
    code: "TONE-03", category: "tone", title: "No shouting", severity: "minor", check_kind: "code", check_type: "all_caps",
    params: { allow: ["URJA", "T&C", "UPI", "GST", "FAQ", "OK"] },
    statement: "Do not write whole words in capital letters. Only the logo is in capitals.",
    source_page: 9, source_quote: "We never shout. Whole words in capital letters are reserved for the logo.",
  },
  {
    code: "TONE-04", category: "tone", title: "No pressure language", severity: "minor", check_kind: "both", check_type: "pressure",
    params: { max_exclamations: 1, phrases: ["hurry", "last chance", "don't miss", "dont miss", "act now", "limited time only", "few left", "ends soon", "before it's gone", "buy now or"] },
    statement: "No pressure language such as 'Hurry' or 'Last chance'. At most one exclamation mark.",
    source_page: 9, source_quote: "No pressure language such as “Hurry” or “Last chance”; at most one exclamation mark.",
    examples: [{ bad: "Hurry, offer ends soon!!!", good: "Offer ends 30 November." }],
  },
  // Messaging (guide pages 10–11)
  {
    code: "MSG-01", category: "messaging", title: "Taste first, then protein", severity: "minor", check_kind: "ai",
    statement: "Lead with taste: the first sentence should be about flavour or ingredients, and protein comes after. We are a snack brand, not a supplement.",
    source_page: 10, source_quote: "Lead with taste, then protein. We are a snack people enjoy, not a supplement they endure.",
    examples: [{ bad: "12 g of protein in every bar. Try Cocoa Crunch.", good: "Roasted cocoa and dates in every bar, with 12 g of protein." }],
  },
  {
    code: "MSG-02", category: "messaging", title: "One clear call to action", severity: "minor", check_kind: "ai",
    statement: "Every piece has exactly one clear call to action.",
    source_page: 10, source_quote: "Every post, email and ad has one clear call to action. Two calls to action means none.",
    examples: [{ bad: "Order now, follow us and tag a friend!", good: "Get 20% off the box this week. Order at urjabites.in." }],
  },
  {
    code: "SOC-01", category: "messaging", title: "Hashtags", severity: "minor", channels: ["instagram", "linkedin"], check_kind: "code", check_type: "hashtags",
    params: { max: 3, required: "#UrjaBites" },
    statement: "Use at most three hashtags, written in CamelCase, and always include #UrjaBites.",
    source_page: 11, source_quote: "Use at most three hashtags, written in CamelCase so screen readers can read them, and always include #UrjaBites.",
  },
  {
    code: "SOC-02", category: "messaging", title: "Emoji", severity: "minor", channels: ["instagram", "linkedin", "ad"], check_kind: "code", check_type: "emoji",
    params: { max: 2 },
    statement: "Use at most two emoji in a post, and never instead of words.",
    source_page: 11, source_quote: "Use at most two emoji in a post, and never instead of words.",
  },
  // Terminology (guide page 4)
  {
    code: "TERM-01", category: "terminology", title: "Approved terms and product names", severity: "minor", check_kind: "code", check_type: "glossary",
    statement: "Use the approved terms and product names in the glossary.",
    source_page: 4, source_quote: "Always use the approved terms and product names in the glossary on this page.",
  },
  // Visual identity (guide pages 5–6)
  {
    code: "VIS-01", category: "visual", title: "Logo use", severity: "major", channels: ["instagram", "linkedin", "ad", "website"], check_kind: "ai",
    statement: "Place the logo only on Cream or Cocoa. Never stretch, recolour or rotate it.",
    source_page: 5, source_quote: "Place the logo only on Cream or Cocoa backgrounds. Never stretch, recolour or rotate it.",
  },
  {
    code: "VIS-02", category: "visual", title: "Brand palette", severity: "minor", channels: ["instagram", "linkedin", "ad", "website"], check_kind: "code", check_type: "palette",
    params: { max_delta_e: 12, min_share: 0.08 },
    statement: "Large areas of colour must come from the brand palette.",
    source_page: 6, source_quote: "Large areas of colour must come from the brand palette: Saffron, Cocoa, Cream and Leaf.",
  },
  // Type (guide page 7). Checked in PDF documents and decks, where the fonts are embedded in the file.
  {
    code: "VIS-03", category: "visual", title: "Brand typefaces", severity: "major", channels: ["document"], check_kind: "code", check_type: "typefaces",
    statement: "Set all text in the brand typefaces: Poppins for headlines and Inter for body text.",
    source_page: 7, source_quote: "Set all text in the brand typefaces: Poppins for headlines and Inter for body text.",
  },
  // Claims (guide pages 14–15)
  {
    code: "CLAIM-01", category: "claims", title: "Numbers match approved facts", severity: "major", check_kind: "code", check_type: "facts",
    statement: "Every number we publish must match an approved, current fact.",
    source_page: 14, source_quote: "Every number we publish (customers, protein, prices, offers, ratings) must match an approved, current fact in the fact sheet.",
  },
  {
    code: "CLAIM-02", category: "claims", title: "Superlatives need a source", severity: "blocker", check_kind: "both", check_type: "superlatives",
    statement: "Superlatives such as 'No. 1' or 'best' need a cited source.",
    source_page: 14, source_quote: "Superlatives such as ‘No. 1’ or ‘best’ need a cited source.",
    examples: [{ bad: "India's #1 protein bar", good: "The protein bar 35,000+ customers trust" }],
  },
  {
    code: "CLAIM-03", category: "claims", title: "No health or medical claims", severity: "blocker", check_kind: "both", check_type: "health_claims",
    statement: "Do not claim that a product cures, prevents or treats anything, or boosts immunity.",
    source_page: 15, source_quote: "We make no health or medical claims. Never say a product cures, prevents or treats anything, or that it boosts immunity.",
  },
  {
    code: "DISC-01", category: "claims", title: "Offers carry T&C", severity: "major", check_kind: "code", check_type: "disclaimer",
    params: { triggers: ["% off", "discount", "offer", "sale", "deal", "cashback", "coupon"], required: "T&C apply" },
    statement: "Any offer, discount or price promotion must include 'T&C apply'.",
    source_page: 15, source_quote: "Any offer, discount or price promotion must include the words “T&C apply”.",
  },
  // Built-in rules from public standards (not from the brand guide)
  {
    code: "A11Y-01", category: "accessibility", title: "Images need alt text", severity: "major", channels: ["instagram", "linkedin", "ad", "website"], check_kind: "code", check_type: "alt_text",
    params: { min: 10, max: 150 },
    statement: "Every image needs alt text that describes what it shows.",
    source_doc: "Built-in rule from WCAG 2.2, success criterion 1.1.1", builtin: true,
    source_quote: "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose.",
  },
  {
    code: "A11Y-02", category: "accessibility", title: "Readable text over images", severity: "minor", channels: ["instagram", "linkedin", "ad", "website"], check_kind: "ai",
    statement: "Text placed on an image must have enough contrast to read.",
    source_doc: "Built-in rule from WCAG 2.2, success criterion 1.4.3", builtin: true,
    source_quote: "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1.",
  },
  {
    code: "ADV-01", category: "claims", title: "Unsupported absolute claims", severity: "major", check_kind: "code", check_type: "absolutes",
    statement: "Absolute claims such as '100%' or 'guaranteed' need proof.",
    source_doc: "Built-in rule from the ASCI Code for Self-Regulation, Chapter I", builtin: true,
    source_quote: "Advertisements must not contain claims which are not adequately substantiated.",
  },
];

export type SeedFact = {
  code: string; statement: string; kind: "number" | "text"; value?: number; unit?: "g" | "%" | "inr" | "count" | "rating";
  keywords: string[]; source: string; owner: string; valid_from?: string; expires_on?: string; restricted?: boolean; status?: "approved" | "expired" | "superseded";
};

export const FACTS: SeedFact[] = [
  { code: "F-10", statement: "Each Urja Bites bar has 12 g of protein.", kind: "number", value: 12, unit: "g", keywords: ["protein"], source: "Lab report LR-2026-031", owner: "Product" },
  { code: "F-11", statement: "No added sugar; sweetened with dates.", kind: "text", keywords: ["sugar", "dates"], source: "Recipe sheet v4", owner: "Product" },
  { code: "F-12", statement: "35,000+ customers, as of Oct 2026.", kind: "number", value: 35000, unit: "count", keywords: ["customers", "customer", "people", "fans", "gym-goers", "buyers", "families", "users"], source: "Sales dashboard, 31 Oct 2026", owner: "Sales", valid_from: "2026-10-31" },
  { code: "F-13", statement: "Diwali offer: 20% off the 6-bar box, valid until 30 Nov 2026.", kind: "number", value: 20, unit: "%", keywords: ["off", "offer", "discount", "diwali", "sale"], source: "Offer brief OB-11", owner: "Marketing", valid_from: "2026-10-25", expires_on: "2026-11-30" },
  { code: "F-14", statement: "Dussehra offer: 15% off the 6-bar box (ended 20 Oct 2026).", kind: "number", value: 15, unit: "%", keywords: ["off", "offer", "discount", "dussehra", "sale"], source: "Offer brief OB-09", owner: "Marketing", valid_from: "2026-10-01", expires_on: "2026-10-20", status: "expired" },
  { code: "F-15", statement: "The 6-bar box costs ₹540.", kind: "number", value: 540, unit: "inr", keywords: ["price", "box", "costs", "only", "just", "mrp"], source: "Price list Nov 2026", owner: "Sales" },
  { code: "F-16", statement: "Rated 4.6 out of 5 by 1,200 buyers on urjabites.in.", kind: "number", value: 4.6, unit: "rating", keywords: ["rated", "rating", "stars", "reviews"], source: "Website reviews export, 1 Nov 2026", owner: "Customer care" },
  { code: "F-17", statement: "Available in Bengaluru, Pune and Mumbai.", kind: "text", keywords: ["bengaluru", "pune", "mumbai", "available"], source: "Distribution list Q4", owner: "Sales" },
  { code: "F-18", statement: "Delhi launch planned for January 2027 (confidential until announced).", kind: "text", keywords: ["delhi", "launch"], source: "Board note BN-07", owner: "Founders", restricted: true },
];

export const TERMS: { preferred: string; avoid: string[]; case_sensitive?: boolean; reason: string }[] = [
  { preferred: "Urja Bites", avoid: ["URJA Bites", "Urja bites", "urja bites", "UrjaBites", "Urja-Bites"], case_sensitive: true, reason: "Brand name is always two words, capital U and B." },
  { preferred: "no added sugar", avoid: ["sugar-free", "sugar free", "zero sugar"], reason: "Dates contain natural sugar, so 'sugar-free' is inaccurate (fact F-11)." },
  { preferred: "feel-good", avoid: ["guilt-free", "guilt free", "cheat snack"], reason: "We never attach guilt to food (rule TONE-01)." },
  { preferred: "everyday snack", avoid: ["diet snack", "diet bar"], reason: "We are not a diet product." },
  { preferred: "protein bar", avoid: ["energy bar", "chocolate bar", "candy bar"], reason: "Describes the product accurately." },
  { preferred: "Cocoa Crunch", avoid: ["Coco Crunch", "cocoa crunch", "Chocolate Crunch"], case_sensitive: true, reason: "Product name." },
  { preferred: "Peanut Power", avoid: ["Peanut power", "PeanutPower", "peanut power"], case_sensitive: true, reason: "Product name." },
  { preferred: "great value", avoid: ["cheap", "cheapest"], reason: "'Cheap' suggests low quality." },
];

export const PALETTE: { name: string; hex: string; note: string }[] = [
  { name: "Saffron", hex: "#F4A300", note: "Primary. Backgrounds and highlights." },
  { name: "Cocoa", hex: "#4A2C1D", note: "Text and logo background." },
  { name: "Cream", hex: "#FFF4E0", note: "Backgrounds and logo background." },
  { name: "Leaf", hex: "#2F7D32", note: "Accents only." },
];

export const TYPEFACES: { name: string; note: string }[] = [
  { name: "Poppins", note: "Headlines" },
  { name: "Inter", note: "Body text" },
];

/** `corrected`: the same document with every problem fixed, to try "Upload a corrected PDF" in the demo. */
export type SeedDocument = { key: string; title: string; file: string; pages: number; note: string; corrected?: string };

/** Sample PDFs (built by scripts/make-sample-docs.ts). The deck's planted problems are listed in eval/cases.ts. */
export const SAMPLE_DOCUMENTS: SeedDocument[] = [
  { key: "diwali-deck", title: "Diwali retail deck", file: "/samples/urja-diwali-retail-deck.pdf", pages: 10, note: "A 10-page deck for store partners: problems on several pages, and one page in the wrong typeface.", corrected: "/samples/urja-diwali-retail-deck-corrected.pdf" },
  { key: "one-pager", title: "Cocoa Crunch one-pager", file: "/samples/urja-cocoa-crunch-one-pager.pdf", pages: 1, note: "A clean control: the checker should find nothing." },
];

export type SeedDraft = { key: string; title: string; channel: "instagram" | "linkedin" | "email" | "website" | "ad"; body: string; alt_text: string; image?: string; note: string };

export const SAMPLE_DRAFTS: SeedDraft[] = [
  {
    key: "diwali-ad",
    title: "Diwali ad creative",
    channel: "ad",
    body: "Celebrate Diwali with Urja Bites. Order your 6-bar box today. T&C apply.",
    alt_text: "",
    image: "/samples/diwali-ad.png",
    note: "An image ad: off-brand colour and logo, claims inside the picture, no alt text.",
  },
  {
    key: "diwali-post",
    title: "Diwali offer post",
    channel: "instagram",
    body: "India's #1 protein bar, trusted by 50,000+ gym-goers. Hurry, offer ends soon!!! Grab 20% off the 6-bar box this Diwali. #protein #fitness #healthysnacks #diwali",
    alt_text: "",
    note: "The example from the Round 1 plan. Several issues across categories.",
  },
  {
    key: "newsletter",
    title: "November newsletter",
    channel: "email",
    body: "Subject: The sugar-free snack that cures your 4 pm slump\n\nHi there,\n\nOur Peanut power bar is back and it is 100% guaranteed to keep you full, and because it boosts immunity and is packed with 15 g of protein it is the perfect guilt-free treat for busy days when you need energy, focus and a bit of joy. Get 15% off this week with code URJA15. Order today, or follow us on Instagram for recipes!\n\nTeam Urja",
    alt_text: "",
    note: "Health claim, expired offer, wrong protein number, terminology and readability issues.",
  },
  {
    key: "linkedin",
    title: "Team milestone post",
    channel: "linkedin",
    body: "We just crossed 35,000 customers across Bengaluru, Pune and Mumbai. Thank you to every family that made Urja bites part of their day. A guilt-free win for all of us. #UrjaBites #MadeInIndia",
    alt_text: "Our team of twelve smiling outside the Pune kitchen, holding Urja Bites boxes.",
    note: "Mostly clean, two terminology slips.",
  },
  {
    key: "website",
    title: "Product page: Cocoa Crunch",
    channel: "website",
    body: "Cocoa Crunch is the flavour that started it all: real cocoa, roasted peanuts and dates. Each bar has 12 g of protein and no added sugar. A box of six costs ₹540. Order a box for your week.",
    alt_text: "A Cocoa Crunch bar broken in half on a cream plate.",
    note: "A clean control: the checker should find nothing.",
  },
];
