# Proofmark

**Brand guidelines as code.** Every draft (a post, an ad, an email, web copy, or a PDF deck) is checked against the
brand's approved rules, facts and assets before it is published. Every issue comes with the rule it breaks, where that
rule comes from, and a suggested fix. A person always makes the final call.

Built for **CodeZen 2026, Round 3** by team **SoloStack** (solo: Aryan Mandavgane). Problem statement by Inkloom AI.

**Live demo:** https://proofmark-flame.vercel.app

**Demo access: no username, no password.** "Start the live demo" gives you a private copy of a workspace for the
fictional snack brand *Urja Bites*, with four people you can switch between with **Acting as**: Arjun writes (creator),
Meera manages the brand, Ritu reviews legal claims, Kabir reviews design.

## Try it in two minutes

On the home page, **New since Round 2** has one button per improvement; each starts the demo and opens it as the right
person. Or start the demo and use **Start here**:

1. **A deck (improvement 1):** "Check the sample deck, as Arjun". Ten pages are checked: each finding names its page,
   page 4's font is flagged as not a brand typeface, and the words in page 1's picture are read too.
2. **A fact changes (improvement 2):** "Change fact F-12, as Meera". Edit the customer count to 30,000+ and save: the 5
   approved drafts that quoted the old figure are listed, their owner is told, and one click re-checks each.
3. **A rule is reworded (improvement 3):** "Reword rule MSG-01, as Meera". Propose clearer wording and preview it: every
   past decision on the rule is replayed, with what would change (3 of 5) and whether the new wording fits what people
   decided better, before you publish.
4. **The main journey:** open the sample post, check it, accept a fix or dispute a finding, submit for review, switch to
   the reviewer and approve. The approval is tied to the exact version.

## Round 3: the three improvements

Each was named in Round 2 with a "done when" test. Here is that wording, what was built, and the evidence.

### 1. PDF documents and slide decks as a content format

> *Done when: a 10-page Urja Bites deck is checked page by page, every finding shows its page and quote, fonts outside the
> brand typefaces are flagged, and the scored test set includes PDF cases with published scores.*

- **Built:** upload a PDF of up to **100 pages** (Round 2 promised 20; real 45- and 58-page lecture decks needed more) and
  15 MB, straight to private storage. Every page gets the same code checks, AI checks and proof check as posts, plus a check
  that fonts are the brand typefaces. Each finding shows its page and quote and links to that page in the PDF. The document
  goes through the same review, and the reviewer approves the **exact file** (its SHA-256 is recorded and re-checked). A
  corrected PDF becomes the next version. Beyond the promise: the AI reads the words in a deck's largest pictures (a
  "50% OFF" baked into a slide image) and checks them for claims.
- **Evidence:** the 10-page sample deck is checked page by page in a browser test; on the scored PDF cases, **100% of
  problems found on the right page, 100% precision, typeface pages 3 of 3** ([eval/RESULTS.md](eval/RESULTS.md)). Five real
  decks from Keynote, Chrome, PowerPoint, Canva and Google Slides (9 to 67 pages) read in 0.2 to 1.4 s, with every finding a
  real rule hit; files that cannot be checked are refused with the exact reason.
- **Before:** a document could only be checked by pasting its text. **After:** the deck itself, page by page, approved as a file.

### 2. Outdated-content alerts

> *Done when: editing fact F-12 (the customer count) lists every approved draft that quoted the old figure, with none
> missed on a seeded test set, and each can be re-checked in one click. When a fact expires, or the brand manager sets its
> expiry date (for example the Diwali offer), the drafts that mention it are listed.*

- **Built:** when a fact's value or wording changes, or it expires or is set to expire, every approved draft that relied
  on it is listed on the fact and on Insights, and its owner is notified in the app. One click re-checks it against today's
  facts: if it no longer holds, the approval is withdrawn and it goes back for changes; if it does, the alert closes. Each
  fact keeps a history of its changes and what happened to each draft. Confidential facts never raise alerts creators
  could read.
- **Evidence:** editing F-12 finds **5 of 5** approved samples that quote it, written in different ways ("35k customers",
  "35,000 families"), with **no false alert**; every fact against every sample is right. On **40 held-out sentences
  written by an independent labeller** (a separate AI agent that never saw the code) before the first run: first 60% found, now **90% found with 100% precision**.
- **Before:** a changed fact left approved content quietly out of date. **After:** every affected draft is found when the
  fact is saved.

### 3. Rule-change replay

> *Done when: proposing new wording for a flagged rule (for example "taste first", MSG-01) shows "would now pass / would
> now flag" for every past decision on that rule, with the number that changes and agreement with the human decisions
> before and after, before the manager publishes.*

- **Built:** before new wording for an AI-checked rule is published, every past decision on that rule is judged under the
  current and the new wording, by an AI that never sees what people decided. The page shows each case ("would now pass",
  "would now flag", "unchanged"), the number that changes, agreement with people's decisions before and after, and in plain
  words whether the new wording fits better. Publishing is two-step, so the replay is always seen first, and it is saved
  with the published rulebook version. Rules checked only by code are not replayed, and the page says why.
- **Evidence:** for MSG-01 with the AI's proposed wording, **3 of 5** past decisions would change, and agreement with the
  people who decided goes from **2 of 4 to 4 of 4**.
- **Before:** a reworded rule was published blind. **After:** its effect on past decisions is known first.

All three are covered by browser tests on the live site, in Safari's engine, Firefox and at phone sizes.

## Complete feature list

| Area | What works |
|---|---|
| Brand setup | Import a brand-guide PDF: the AI drafts numbered rules with their quote and page, code confirms each quote is in the document, the manager approves and publishes a versioned rulebook. Fact ledger with source, owner, end date and confidential facts, and each fact's history. Glossary of approved terms. Colour palette, logo and brand typefaces. Rule check settings edited on screen |
| Content | Posts, ads, emails and web copy for Instagram, LinkedIn, email, website or ads; images (PNG, JPEG, WebP) with alt text; PDF documents and decks of up to 100 pages |
| Checks | 14 code checks run first: numbers against facts, ended offers, superlatives, health and absolute claims, T&C on offers, approved terms, reading level per channel, capitals, pressure language, hashtags, emoji, alt text, brand colours, brand typefaces. The AI checks only what code cannot: tone, messaging, claims in context, logo use, and words in images and deck pictures |
| Trust | Proof check: an AI finding is shown only if its quote is really in the draft and its rule is approved and applies. A second opinion on tone and messaging. Every finding is labelled *verified by code*, *AI verified* or *needs human judgment* |
| Review | Accept a fix, edit, or dispute each finding; comments; versions with word-level differences; routing by risk to legal or design; review steps showing whose turn it is; override with a reason; approval tied to the exact version or file, withdrawn by any later edit; "Copy approved text" and a printable approval record; append-only audit trail |
| Keeping content current | Outdated-content alerts when a fact changes or ends, one-click re-check, notifications |
| Insights | Repeated mistakes by rule, category and channel; rules flagged as unclear from real disputes and overrides; AI-proposed clearer wording; rule-change replay before publishing; claims with no approved fact; decisions kept as test cases (JSON download) |
| Reliability | Code findings at once and the AI in the background with a 40-second budget; a plain message whenever the AI cannot run, with "Run the checks again"; every action done twice happens once; stale tabs and wrong-person actions explained; an action still running after 10 seconds says so |
| Privacy | Access rules enforced by the database; confidential facts never reach creators or the AI; "code checks only" mode; an AI and data page listing every model, service and what each receives |

## What changed since Round 2

Every Round 2 open end is closed or declared, and reliability, usability and accuracy improved throughout:
[docs/CHANGES_SINCE_ROUND2.md](docs/CHANGES_SINCE_ROUND2.md). Every decision and its reason:
[docs/ROUND3_PLAN.md](docs/ROUND3_PLAN.md).

## Tests and scores

| What | Result |
|---|---|
| Unit tests (`npm test`) | 173 passing |
| Browser tests (`npx playwright test`) | 60: every journey, the three improvements, a reliability matrix (bad input, empty states, refresh, the same action twice, stale tabs, AI trouble), every page as every person at desktop and phone width, and accessibility (zero WCAG 2.1 A/AA violations by axe, keyboard only) |
| Other browsers | The 12 main journeys in Safari's engine, Firefox, and at iPhone and Pixel sizes: 48 of 48 |
| Database attacks (`npm run rls-check`) | 32 of 32 refused |
| Scored test set (`npm run eval`) | Code checks: 100% found, 100% precision. Code + AI: 97% found, 98% precision. PDFs: 100% / 100%. Alerts: 5 of 5, held-out 90% / 100%. Replay: 3 of 5 change, agreement 2 of 4 → 4 of 4 |
| User tests | Five people, four tasks, no help; after the changes, all five reached "Approved" |

What was tested and how, what testing found and fixed, and what is still imperfect: [docs/TESTING.md](docs/TESTING.md).
User tests: [docs/USER_TESTING.md](docs/USER_TESTING.md). Scores with their history: [eval/RESULTS.md](eval/RESULTS.md).

## How it is built

- **Next.js 16** (App Router, server actions, TypeScript, Tailwind CSS 4) on **Vercel**, functions in Mumbai.
- **Supabase** (Mumbai): Postgres with row-level security, anonymous sign-in for the demo, private file storage.
- **Google Gemini** (`gemini-3.5-flash-lite`, fallback `gemini-3.1-flash-lite`) behind one provider interface, with JSON
  schemas, time limits, stored answers and daily caps.
- **pdf.js** through unpdf (PDF text, fonts and pictures), **sharp** (images), **Zod**, **diff**.
- **Vitest**, **Playwright**, **axe**, GitHub Actions.

Components, data flow, the security model and the hardest problems: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it yourself

Tested from a fresh clone: the migrations on a brand-new Supabase project (23 Nov 2026), then clone, install, migrate,
typecheck, lint, unit tests, key browser journeys and the database attack tests (24 Nov).

**You need:** Node.js 22 (20.9 or later works), Google Chrome (for the browser tests), a free
[Supabase](https://supabase.com) account and a [Gemini API key](https://aistudio.google.com/apikey).

1. **Get the code**
   ```bash
   git clone https://github.com/aryanmandavgane02/proofmark.git
   cd proofmark
   npm ci
   ```
2. **Create a Supabase project** (any region; the live demo uses Mumbai). In its dashboard:
   - *Authentication → Sign In / Providers:* turn on **Allow anonymous sign-ins** (the demo signs visitors in anonymously).
   - *Authentication → Rate Limits:* raise **anonymous users** to 1000 per hour if you will run the browser tests (they
     start many demos; the default is low).
3. **Add your keys:** `cp .env.example .env.local`, then fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`: *Project Settings → Data API → Project URL*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`: *Project Settings → API Keys* (the `anon` and
     `service_role` keys; on the "Legacy API keys" tab if there are two)
   - `DATABASE_URL`: *Connect → Session pooler* connection string, with your database password in place of
     `[YOUR-PASSWORD]`
   - `GEMINI_API_KEY`: from Google AI Studio
4. **Create the database:** `npm run db:migrate` applies `supabase/migrations/` in order (tables, access rules, storage
   buckets and grants) and records each one, so it is safe to run again.
5. **Run it:** `npm run dev`, then open http://localhost:3000 and click **Start the live demo**. Each visitor gets a fresh
   copy of the Urja Bites workspace.
6. **Test it:**
   ```bash
   npm run typecheck && npm run lint && npm test   # types, lint, 173 unit tests
   npx playwright test                             # browser tests against http://localhost:3000 (uses your Chrome)
   npm run rls-check                               # database attacks, each must be refused
   npm run eval                                    # scored test set (npm run eval -- --code: no AI requests)
   ```
   To test a deployed copy instead: `BASE_URL=https://your-site npx playwright test`. Other browsers:
   `npx playwright install`, then
   `ALL_BROWSERS=1 npx playwright test --project=safari --project=firefox --project=iphone --project=android`.
7. **Deploy (optional):** import the repository on [Vercel](https://vercel.com) and add the same five variables. Optional:
   `npm run warm` stores the AI answers for the sample drafts, so first checks are instant.

**Troubleshooting**
- *"permission denied for table workspaces":* the migrations did not all run; run `npm run db:migrate` again (migration
  0015 grants table access, which newer Supabase projects no longer do by default).
- *The home page says too many demos were started:* the anonymous sign-in limit was reached; raise it (step 2) or wait.
- *"AI checks did not run this time":* the Gemini key is missing or invalid, its quota is used, or the daily caps were
  reached (`AI_WORKSPACE_DAILY_CAP` and `AI_GLOBAL_DAILY_CAP`, 60 and 450 by default). Code checks still run.
- *Browser tests time out locally:* the development server builds pages on first visit; run them again, or against
  `npm run build && npm start`.

## Limits

- AI findings on judgment rules ("taste first", "one call to action") are less reliable than code findings; they are minor,
  never block approval, and are labelled when the second opinion disagrees.
- Inside a deck's pictures only the words are checked, not logos, colours or photos. Fonts and layout inside images are not
  checked. Brand guides to import are limited to 4 MB and 40 pages.
- An AI proposal for clearer wording can differ from one request to the next; the replay shows each one's effect before
  anything is published.
- The demo uses anonymous sessions: no email sign-up or multi-company setup yet. The free hosting tiers can slow down under
  heavy load.

## What comes next

Real accounts and companies, an AI plan that does not train on customer content, notifications by email, decks from
Google Drive, full picture checks, Hindi and Hinglish: [docs/ROADMAP.md](docs/ROADMAP.md).

## Data used

All brand data is fictional: the Urja Bites brand guide (`public/samples/`, generated from `src/lib/seed/`), facts, sample
drafts, images and decks, and a labelled sample history. No real customer or brand data is used, because the free Gemini
tier may use submitted content. User research: [docs/USER_RESEARCH.md](docs/USER_RESEARCH.md).

## Contribution and disclosures

Built solo by Aryan Mandavgane with **Claude Code** (Anthropic) as a disclosed AI assistant for code, tests, seed data and
documents, under Aryan's direction and review; commits it helped with carry a `Co-Authored-By` line. Services, libraries and AI
use: [DISCLOSURES.md](DISCLOSURES.md). Earlier rounds: Round 1 plan [docs/round1/](docs/round1/), Round 2 report
[docs/round2/](docs/round2/), Round 2 build plan [docs/PLAN.md](docs/PLAN.md). Licence: MIT.
