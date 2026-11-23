# Proofmark

**Brand guidelines as code.** Every draft is checked against approved rules, facts and assets before it is published. Every issue comes with the rule it breaks, where that rule comes from, and a suggested fix. A person always makes the final call.

Built for **CodeZen 2026, Round 2 (The Build)** by team **SoloStack** (solo: Aryan Mandavgane). Problem statement by Inkloom AI.

**Live demo:** https://proofmark-flame.vercel.app · no sign-up · each visitor gets a private copy of a demo workspace for the fictional snack brand *Urja Bites*.

## Try it in two minutes

1. Open the live demo and click **Start the live demo**. The **Start here** page has a five-step guided checklist.
2. As **Arjun** (agency creator), open the sample Instagram post and click **Check this draft**. Findings appear in six categories (claims, terminology, tone, messaging, visual, accessibility). Each one has the quoted text, the rule with its page in the brand guide, the reason and a suggested fix.
3. **Accept a fix** (for example the wrong customer number). A new version is created and re-checked.
4. **Dispute** a finding, then **Submit for review**. The draft is routed by risk: claims go to Ritu (legal).
5. Switch **Acting as** to the reviewer, resolve the dispute and **Approve**. The approval records the exact version, the rulebook version and any overrides. See the **Audit trail**.

More to try, linked from Start here: an **image ad** (logo, colours, text in the picture, alt text), **importing rules from a brand-guide PDF** as Meera (brand manager), and **Insights** (a rule flagged as unclear, with AI-proposed clearer wording).

## What it does

| Area | What is built |
|---|---|
| Brand setup | Import a brand-guide PDF: the AI drafts numbered rules with quote and page, code confirms each quote is in the document, the manager approves and publishes a versioned rulebook. Fact ledger with source, owner, expiry and confidential facts. Glossary. Colour palette and logo |
| Intake | Posts, ads, emails and web copy as text, for Instagram, LinkedIn, email, website or ads; images (PNG, JPEG, WebP) with alt text. PDF documents and decks of up to 100 pages (Round 3): every page is checked, every finding names its page, and the brand typefaces are checked; a reviewer approves the exact file |
| Checks | 14 code checks run first (facts and numbers, expired offers, superlatives, health and absolute claims, T&C on offers, terms, reading level, capitals, pressure language, hashtags, emoji, alt text, brand colours, brand typefaces in PDFs). AI checks only what code cannot: tone, messaging, claims in context, logo use and text in images |
| Trust | Proof check: an AI finding is shown only if its quote is really in the draft and its rule is approved and applies. A second opinion on tone and messaging. Every finding is labelled *verified by code*, *AI verified* or *needs human judgment* |
| Workflow | Accept, edit or dispute each finding; comments per finding; versions with word-level differences; routing by risk to legal or design; override with a reason; approval tied to the exact version, withdrawn by any later edit; append-only audit trail |
| Insights | Repeated mistakes by rule, category and channel; rules flagged as unclear from real disputes and overrides, with AI-proposed clearer wording that publishes a new rulebook version; claims without a fact; human decisions kept as test cases (JSON download) |
| Privacy | Access rules enforced by the database; confidential facts never reach creators or the AI; a "code checks only" mode; an "AI & data" page listing every model and service |

Feature status against the Round 1 plan and every change from it: [docs/CHANGES_FROM_PLAN.md](docs/CHANGES_FROM_PLAN.md).

## Technology and implementation

- **Next.js 16** (App Router, server actions, TypeScript, Tailwind CSS 4) on **Vercel**, functions in Mumbai.
- **Supabase**: Postgres with row-level security, anonymous sign-in for the demo, private file storage. Migrations in `supabase/migrations/`.
- **Google Gemini** (`gemini-3.5-flash-lite`, fallback `gemini-3.1-flash-lite`) through one provider interface (`src/lib/ai/`), with JSON schemas, a timeout, a retry, answers stored by exact prompt, and daily caps.
- **sharp** (image colours and contrast), **unpdf** (PDF text by page), **Zod**, **diff** (version differences).
- **Tests:** Vitest, Playwright, GitHub Actions (CI on every push, and a daily check of the live site and database).

How it fits together, the check pipeline and the security model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests and scores

| What | Result |
|---|---|
| Unit tests (`npm test`) | 89 passing: every code check, the proof check, colours, image findings, PDF import verification, insights |
| Browser tests (`npx playwright test`) | 12 passing, locally and against production: judge path, image ad, review workflow, brand setup, insights (two), switching person, home page and starting over, the Back link, and accessibility: no WCAG 2.1 A/AA violations found by axe on any screen, no sideways scrolling at phone width, and the demo usable by keyboard alone |
| Database access attacks (`npm run rls-check`) | 22 of 22 refused, e.g. a creator marking a blocker accepted, forging an approval, or writing an audit entry in someone else's name |
| Scored test set (`npm run eval`) | 27 hand-labelled drafts. Code checks: 100% of problems found, 100% precision, 5/5 clean drafts untouched. Code + AI: 95% found, 93% precision, 3/5 clean drafts untouched (AI false alarms on judgment rules, two of three already labelled *needs human judgment*). Details and failure notes: [eval/RESULTS.md](eval/RESULTS.md) |

## Data used

All brand data is fictional: the Urja Bites brand guide (`public/samples/urja-brand-guide.pdf`, generated from `src/lib/seed/`), facts, sample drafts and images, and a labelled sample history on the Insights page. No real customer or brand data is used, because the free Gemini tier may use submitted content. User research: the Round 1 survey and five follow-up answers in [docs/USER_RESEARCH.md](docs/USER_RESEARCH.md).

## User testing

Five people used the live demo on their own, unassisted, during the build window: a college student, a small-business owner, a freelance designer, a startup marketing executive and a student-club social media manager.

- **All five reached "Approved"**, in 3 to 5½ minutes (average about 4¼).
- **What they understood:** wrong prices, outdated facts and spelling were clear to everyone; the marketing executive found the references to brand rules useful.
- **Where they got stuck, and what changed as a result:**

| What testers said | Who | What we changed |
|---|---|---|
| Unsure which findings block approval and which are only suggestions | Designer, social media manager | A summary above the findings: what must be dealt with before review, what should be fixed, what is only a suggestion |
| Wanted to see progress towards approval | Marketing executive | A progress bar: "4 of 6 dealt with" |
| Some labels felt technical | Student, social media manager | "What do the labels mean?" explains each label in plain words; open problems are listed first, most serious first |
| Unsure whether a fix used the latest business information | Small-business owner | The suggested fix now shows the approved fact it is based on, with its source and owner |
| Took a moment to find where to start | Student | Already addressed by the guided checklist on Start here; noted for further onboarding work |
| Wanted visual comparisons for logo, colour and font findings | Designer | Colour findings now show swatches: the colour in the image next to the nearest brand colour. Font checks are part of Round 3 improvement 1. Raw answers: [docs/USER_TESTING.md](docs/USER_TESTING.md) |

## Limits

- AI findings on judgment rules (taste first, one call to action) are less reliable than code findings. They are minor (suggestions), so they never block approval, and they are labelled when the second opinion disagrees.
- Image checks cover logo use, brand colours, text in the image and alt text. Fonts and layout are not checked.
- Reading level uses one limit (25 words per sentence) on every channel; stricter per-channel limits are configured but not yet enforced.
- PDFs and decks are not yet a checkable content format (planned for Round 3).
- The demo uses anonymous sessions; there is no email sign-up or multi-company setup.

## Three improvements for Round 3

These are the three named in the Round 1 plan, now **confirmed** by what we built and by user testing. Each will be shown with a before-and-after demonstration and a measured number.

1. **PDF documents and decks as a content format.** Check the text and fonts of each page of a PDF of up to 20 pages (including slide decks exported as PDF) against the rulebook, with findings that point to the page. A user tester (designer) asked for exactly this kind of font and layout feedback. *Done when:* a 10-page deck is checked page by page, every finding shows its page and quote, fonts outside the brand typefaces are flagged, and the scored test set includes PDF cases with published scores.
2. **Outdated-content alerts.** When a fact changes or expires, list the approved content that relied on it and notify its owner. A user tester (small-business owner) asked whether fixes use the latest information; this answers it over time. *Done when:* editing fact F-12 lists every approved draft that quoted the old figure (all of them, measured), and each can be re-checked in one click.
3. **Rule-change replay.** Before publishing a reworded rule checked by AI (whose behaviour depends on its wording), replay it against the stored decisions (already kept as test cases) and show which past findings would change. *Done when:* proposing clearer wording shows "would now pass / would now flag" for every past decision on that rule before the manager publishes, with the count of decisions that would change.

## Run locally

```bash
npm install
cp .env.example .env.local   # Supabase URL and keys, database URL, Gemini API key
npm run db:migrate
npm run dev                  # http://localhost:3000
npm test && npx playwright test && npm run rls-check && npm run eval
```

## Contribution and disclosures

Built solo by Aryan Mandavgane with **Claude Code** (Anthropic) as a disclosed AI assistant for code, tests, seed data and documents, under his direction and review; commits it helped with carry a `Co-Authored-By` line. Services, libraries and AI use: [DISCLOSURES.md](DISCLOSURES.md). Round 2 report (PDF): [docs/round2/](docs/round2/). Round 2 build plan: [docs/PLAN.md](docs/PLAN.md). Round 1 plan: [docs/round1/](docs/round1/). Round 3 preparation: [docs/ROUND3.md](docs/ROUND3.md). Licence: MIT.
