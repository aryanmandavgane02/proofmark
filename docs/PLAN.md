# Proofmark: Round 2 build plan

**Team SoloStack (solo: Aryan Mandavgane) · CodeZen 2026 · Round 2, The Build**
**Window:** Monday 16 Nov 2026, 10:00 IST to Thursday 19 Nov 2026, 10:00 IST (72 hours)
**Written:** Monday 16 Nov 2026, at the start of the window. No product code existed before the window opened. Work goes phase by phase, at whatever hours suit; the only fixed time is the deadline. The Round 1 plan this builds on is in [round1/](round1/).

AI assistance: this plan and the code are produced with Claude Code (Anthropic). Every commit made with its help carries a `Co-Authored-By` line. See DISCLOSURES.md.

---

## 1. What Round 2 has to deliver

**The scored workflow** (from the organisers): content goes in before it is published (a post, an advertisement, an email or a document) and is checked against the organisation's approved brand guidelines, approved facts, terminology and visual identity. Every issue comes back with the rule it breaks and a suggested correction, and a human makes the final approval. A judge must be able to open the link and use this without help. A login screen, a settings page or an empty dashboard does not count.

**Submission items**

| # | Item | Where it will live |
|---|---|---|
| 1 | Working project link | Vercel production URL |
| 2 | Source-code repository link | Public GitHub repository |
| 3 | Updated project PDF | `docs/round2/`, shared from Google Drive |
| 4 | List of completed features | README, PDF, form |
| 5 | Technology and implementation details | README, `docs/ARCHITECTURE.md`, PDF, form |
| 6 | Explanation of changes made to the original plan | `docs/CHANGES_FROM_PLAN.md`, PDF, form |
| 7 | Three major improvements for Round 3 (meaningful, not cosmetic) | README, PDF, form |

The problem statement also asks for: architecture and main technical decisions, details of APIs, AI models, datasets, libraries, templates and external services, evidence of user testing, and a statement of each member's contribution.

**How Round 2 is scored**

| Criterion | Points | What we do about it |
|---|---|---|
| Core workflow runs end to end | 30 | Thin loop live on day 1, no sign-up needed, guided demo, sample drafts |
| Technical depth and reliability | 25 | Code-first checks, proof check, stored results, graceful failure, tests, scored test set |
| Progress against the plan | 20 | All 10 core features from Round 1 delivered, status table, honest change log |
| The three improvements you named | 15 | Specific, meaningful, each with acceptance criteria and a reason |
| Usability so far | 10 | Guided checklist, clear findings screen, fast, readable, keyboard and contrast basics |

---

## 2. Principles

1. **Loop first, depth second.** A thin version of the whole workflow goes live at the end of Phase 1. Every later phase deepens something that already runs.
2. **No account needed to try it.** One click starts a private demo workspace with a ready brand, three people to act as, and sample drafts.
3. **Never hostage to AI quota.** Code checks always return. Sample drafts are served from stored results of real runs. When the AI service fails, the screen says so and still shows the code findings.
4. **Everything shown is traceable.** Each finding carries a rule ID with its source quote and page, or a fact ID. Each has a label. AI findings that fail the proof check are dropped and counted in the open.
5. **Small commits on `main`, every one deployable.** Production is re-tested after each phase.
6. **Honest documents.** What works, what is partial, what changed from the plan, what the limits are, which tools and AI were used.

---

## 3. The judge path (must never break)

This is the three-minute route a judge will take. It is re-tested in a private browser window after every phase.

1. **Landing page:** one sentence on what Proofmark is, and a button: "Start the live demo (no sign-up)".
2. **Guided checklist:** five steps that tick themselves as they are completed. Each step opens the right screen as the right person.
3. **Submit a draft** as Arjun (creator, agency): load the sample Instagram post in one click, press Check.
4. **See findings** in all six categories, each with the rule, the reason and a fix. Accept two fixes, dispute one.
5. **Review and approve** as Ritu (authorised reviewer) or Meera (brand manager): the item arrives with the reason it was routed. Resolve the dispute with a written reason, approve, see the approval record.
6. **Insights** as Meera: repeated mistakes, and rule TONE-04 now flagged as unclear because of the override. Accept the clearer wording, which publishes Rulebook v2.
7. **Optional:** Rulebook, Fact ledger, Import a brand guide, AI and data use.

The demo brand is the fictional **Urja Bites** from the Round 1 plan, with the same people (Meera, Arjun, Ritu) and the same sample post, so the plan's example is the live demo.

---

## 4. Scope

### 4.1 Core: the ten features committed in Round 1

| # | Feature (Round 1 wording) | Round 2 deliverable | Phase |
|---|---|---|---|
| 1 | Brand setup and rulebook | Rulebook screen: approve, edit, reject, severity, channels, publish version. Import a brand-guide PDF: AI drafts numbered rules with source quote and page, code verifies each quote | 1 (view), 6 |
| 2 | Fact ledger, glossary, assets | Facts with source, owner, expiry, restricted flag. Preferred and banned terms. Colour palette and logo | 1 (view), 6 |
| 3 | Text and image intake | Paste text, upload an image with caption and alt text, choose the channel, load a sample | 1, 4 |
| 4 | Code checks | Terms and spellings, required disclaimers, brand colours, alt text, reading level, hashtag and emoji rules, expired facts, number comparison | 1, 2, 4 |
| 5 | AI checks | Tone, messaging, claims against the fact ledger, logo and imagery use, text inside images | 3, 4 |
| 6 | Proof check and labels | Unverifiable AI findings dropped and counted. Labels: verified by code / AI, evidence verified / needs human judgment | 3 |
| 7 | Explained findings and fixes | Quoted text, rule or fact, reason, before-and-after fix. Accept, edit, dispute | 1, 3 |
| 8 | Review workflow | Three roles, routing by risk, comments, version history with differences, override with reason, approval record, audit trail | 1 (basic), 5 |
| 9 | Insights | Repeated mistakes by rule, channel and team. Rules often overridden or disputed flagged as unclear. Missing facts | 7 |
| 10 | Privacy and AI disclosure | Access rules enforced in the database. "Code checks only" mode. Page listing every AI model and external service | 1, 2, 8 |

Also promised in the plan and therefore in scope: intent summary confirmed by the creator, fixes re-checked before they are offered, only changed parts re-checked, results stored against a fingerprint, a scored test set, tests with three to five real users, follow-up interviews with survey respondents.

### 4.2 Stretch (only when everything above is green)

- Basic PDF document intake (text only), since PDF text extraction already exists for the guide import
- Email sign-up and inviting teammates into a workspace
- CSV import for facts
- Bar charts on the insights page
- A 90-second screen recording linked from the README

### 4.3 Not in Round 2

The three Round 3 improvements named in the plan: documents as a full format (PDF, Word, PowerPoint with page-anchored findings and font checks), outdated-content alerts when a fact changes, and rule-change replay. Round 2 records the data they need (which facts each draft relied on, and every human decision as a test case) but does not build them.

---

## 5. Architecture

```
Browser (creator · brand manager · authorised reviewer)
        │
Next.js on Vercel ── pages: demo start · guided checklist · drafts · findings · review queue
        │                    rulebook · facts · assets · insights · AI and data use
        │
Check pipeline (server)
   1 Normalise      text and images become blocks with positions
   2 Code checks    no AI request, same result every time
   3 AI checks      at most three requests per review (text, image, second opinion)
   4 Proof check    quote must exist in the draft, rule or fact must be approved and apply
   5 Merge, label, route, store   (stored against a fingerprint of content + rulebook version)
        │
Supabase                         AI provider interface            Test-set runner
 Postgres + row-level security    Gemini API (free tier) today     scores planted issues caught
 Auth (anonymous for the demo)    mock provider for tests          and wrong flags raised
 Private file storage             replaceable
```

**Stack:** Next.js (App Router, TypeScript), Tailwind CSS and shadcn/ui, Supabase (PostgreSQL, Auth, Storage, row-level security), Google Gemini API through a provider interface, sharp (image pixels), unpdf / pdf.js (PDF text by page), Zod (AI output validation), diff (version differences), Vitest, Playwright, GitHub Actions, Vercel.

**Data model**

| Table | Holds |
|---|---|
| `workspaces`, `members` | One workspace per organisation or demo visitor. Members carry a role: creator, manager, reviewer |
| `rules`, `rulebook_versions` | Numbered rules with category, severity, channels, check type and parameters, source quote and page, status. A published version is a snapshot |
| `facts` | Approved facts with value, source, owner, expiry, restricted flag |
| `assets` | Palette colours and logo files |
| `drafts`, `draft_versions` | Content, channel, status, each saved version with its fingerprint and confirmed intent |
| `check_runs`, `findings` | One row per pipeline run (time, AI requests, model, stored-result hit, dropped findings) and one row per finding |
| `decisions`, `comments` | Accept, edit, dispute, uphold, override, each with who and why. These are the test cases |
| `approvals` | Approver, time, content fingerprint, rulebook version, overrides, AI services used |
| `events` | Append-only audit trail |
| `check_cache`, `ai_usage` | Stored results by fingerprint, and AI request counts for limits |

**Access rules:** every table is scoped to workspace membership by row-level security. Restricted facts are readable only by managers and reviewers. `events` allows inserts only. The service key is used on the server for demo seeding alone.

**Demo workspace:** "Start the live demo" creates an anonymous session and a private copy of the Urja Bites workspace (rules, facts, palette, logo, sample drafts, labelled sample history). The visitor can act as Arjun, Meera or Ritu through a switcher, and each action is recorded under that person.

**AI use per review:** one text request (tone, messaging, claims, intent summary, fixes), one image request when there is an image (text in the image, logo and imagery, suggested alt text), one second-opinion request for judgment calls. Rule drafting during guide import is separate and happens once per guide.

**Safety of the AI step:** the draft is passed as data, never as instructions. AI output can only become findings, and only after the proof check. It cannot approve, publish or change roles.

---

## 6. Phases

Order differs from the Round 1 plan on purpose: the checker is built before the setup screens, because it is the riskiest part and the part the organisers score. The demo starts with a seeded, approved rulebook, so nothing waits on the setup screens. This is recorded in `CHANGES_FROM_PLAN.md`.

**Every phase is done only when:** it is deployed to production, the judge path passes in a private window, tests are green, the work is committed with a clear message, and the boxes below are ticked.

### Phase 0 · Setup and first deploy

- [x] Accounts and keys (Aryan): GitHub repository, Supabase project with anonymous sign-ins on, Gemini API key, Vercel project
- [x] Scaffold Next.js, Tailwind, shadcn/ui, Supabase client, env handling *(shadcn/ui not used: a few plain Tailwind components in `src/components/ui.tsx` were enough)*
- [x] Repository hygiene: `.gitignore`, MIT licence, README stub, DISCLOSURES stub, this plan, the Round 1 PDF
- [x] Migration runner and CI (typecheck, lint, unit tests)
- [x] Gemini smoke test: model list, JSON output against a schema, image input, rate limits noted
- [x] First deploy

**Done when:** the production URL shows the landing page, the first commits are pushed, and the Gemini smoke test returns valid JSON.

### Phase 1 · Walking skeleton — Round 1 phase 1

- [x] Database schema, row-level security, migration applied
- [x] Demo start: anonymous session, seeded private workspace, people switcher
- [x] Seed data v1: Urja Bites rules across six categories, facts, terms, palette, four sample drafts
- [x] New draft: channel, title, text, alt text, "load a sample"
- [x] Pipeline v0: normalise, banned and preferred terms, findings stored
- [x] Findings screen: highlighted text, finding cards with rule, source quote and page, reason, fix, label
- [x] Accept a fix (new version), dispute with a reason
- [x] Submit for review, reviewer queue, approve or request changes, audit events
- [x] Read-only Rulebook and Fact ledger pages
- [x] Landing page and first guided checklist

**Done when (Round 1 wording):** on the live link, a creator's text is flagged with its rule and a reviewer approves it.

### Phase 2 · Code checks, complete — part of Round 1 phase 3

Each check is a pure function with unit tests.

- [x] Banned and preferred terms, product spellings and casing
- [x] Required disclaimers (trigger words require a set text)
- [x] Punctuation and shouting (exclamation marks, all-caps words)
- [x] Hashtag rules (count, capitalised words) and emoji rules
- [ ] Reading level per channel *(partial: one limit of 25 words per sentence on every channel; the per-channel averages are configured in the rule but not yet enforced)*
- [x] Alt text present and of useful length
- [x] Superlatives and absolute claims that need a supporting fact
- [x] Numbers compared with the fact ledger, expired and superseded facts
- [x] "Code checks only" mode

**Done when:** the sample drafts produce the right code findings and at least 40 unit tests pass in CI.

**Checkpoint A (end of Phase 2):** thin loop live, all text code checks working.

### Phase 3 · AI checks and proof check — part of Round 1 phase 3

- [x] Provider interface, Gemini implementation, mock provider, retry with back-off, usage log, per-workspace and global daily limits *(no mock provider: checks are unit-tested as pure functions and the AI path is tested end to end)*
- [x] Text request: tone, messaging, claims with verdict against the ledger, intent summary, suggested fixes, strict JSON schema
- [x] Proof check: exact quote match gives positions, rule or fact exists, is approved and applies to the channel, suggested fix re-checked by code checks
- [x] Labels, merge with code findings on the same text
- [x] Second-opinion pass for tone and messaging (first item in the cut order)
- [x] Intent card: confirm or edit
- [x] Stored results by fingerprint, sample drafts pre-stored from real runs
- [x] Failure mode: AI unavailable banner, code findings still shown, retry button
- [x] Transparency panel: model, requests used, time, stored-result hit, findings dropped by the proof check and why

**Done when:** the sample Instagram post returns tone, terminology, messaging, claims and accessibility findings with rule and fix, every AI finding has a verified quote, and with the API key removed the code findings still appear under a clear banner.

### Phase 4 · Images and visual identity — part of Round 1 phase 3

- [x] Upload straight to private storage, type and size limits, preview *(uploaded through the server, which checks the type and size and that the file really decodes as an image)*
- [x] Dominant colours against the palette (colour difference), finding with swatches and nearest brand colour
- [x] Image request: text inside the image (then checked like any other text), logo and imagery use against the reference logo, suggested alt text labelled as AI
- [x] Sample ad creative made during the window

**Done when (Round 1 wording):** demo content gets cited findings with fixes in all six categories.

### Phase 5 · Review workflow, complete — Round 1 phase 4

- [x] Statuses and submit rules, routing by risk with the reason shown
- [x] Reviewer queue and review screen, comments
- [x] Uphold or override a disputed finding, reason required
- [x] Approve or request changes
- [x] Version list with differences, only changed parts re-checked *(after an accepted fix, AI findings on unchanged text are reused; a hand edit is re-checked in full; code checks always re-run, in milliseconds)*
- [x] Approval record: fingerprint, rulebook version, approver, overrides, AI services used
- [x] Edit after approval sends the draft back for re-approval
- [x] Audit trail view

**Done when (Round 1 wording):** a draft passes a revision, a dispute and an approval, and a later edit needs re-approval.

**Checkpoint B (end of Phase 5):** the whole scored workflow works on production for text and images.

### Phase 6 · Brand setup — Round 1 phase 2

- [x] Rulebook screen: filter, approve, edit, reject, severity, channels, check parameters, publish version, version history *(rules are grouped by category instead of filtered; check parameters are not editable on screen)*
- [x] Fact ledger screen: add, edit, source, owner, expiry, restricted
- [x] Terminology and assets screens
- [x] Urja Bites brand guide PDF, made during the window from the seed rules so quotes and pages match
- [x] Import: upload PDF, text by page, AI drafts rules, code verifies each quote, drafts wait for approval. Stored result for the sample guide

**Done when (Round 1 wording):** an uploaded brand PDF becomes an approved rulebook v1.

### Phase 7 · Insights — Round 1 phase 5

- [x] Sample history, labelled as such, so the page is never empty
- [x] Repeated mistakes by rule, category and channel
- [x] Rules that may be unclear: override and dispute counts, flag above a threshold, clearer wording proposed, accept publishes a new rulebook version
- [x] Missing facts: unsupported claims grouped, with "add fact"
- [x] Decisions stored as test cases, count per rule

**Done when (Round 1 wording):** a rule is flagged as unclear from real decisions.

### Phase 8 · Proof and packaging — Round 1 phase 6

**A. Proof (user tests run alongside phases 6 and 7)**

- [x] User tests: link and task sent once Phase 5 is live, three to five people, five-question form, results in `docs/USER_TESTS.md`, top issues fixed *(five people, four questions; results in `docs/USER_TESTING.md`)*
- [x] Guided checklist polish, loading, empty and error states, AI and data use page
- [x] Own-screen basics: labels, contrast, keyboard, phone width *(automated: `e2e/accessibility.spec.ts`)*
- [x] Playwright test of the judge path, CI green
- [x] Scored test set: at least 20 cases with planted issues and clean controls, results in `eval/RESULTS.md` (issues caught, wrong flags, findings dropped by the proof check)
- [x] Keep-alive ping, quota check
- [ ] **Feature freeze** once Phase 7 is done, and no later than Wednesday night. Only fixes after this

**B. Packaging**

- [x] README: try it in two minutes, feature status against the Round 1 plan, technology and implementation details, architecture, AI models, services, libraries and templates, data used, tests and scores, user testing, limits, changes from plan, three improvements, contribution
- [x] `docs/ARCHITECTURE.md`, `docs/CHANGES_FROM_PLAN.md`, `DISCLOSURES.md`
- [x] Updated PDF with real screenshots
- [x] Three improvements for Round 3, confirmed or revised from user feedback, each with acceptance criteria
- [ ] Form answers drafted

**C. Submit (Thursday morning, before 10:00)**

- [ ] Judge path on production in a private window, laptop and phone
- [ ] Repository public, no secrets, CI green, README links work
- [ ] PDF on Drive set to "Anyone with the link, Viewer", tested in a private window
- [ ] Submitted with at least an hour to spare. No deploys after the final check

---

## 7. Cut order if we fall behind

From the Round 1 plan, in this order: the second-opinion pass, then the AI logo check (the colour check stays), then dashboard charts (the tables stay).

Then, if still behind: guide import accepts pasted guideline text only, email sign-up is dropped (the demo workspace stays), CSV import is dropped.

**Never cut:** the judge path, findings in six categories with rule and fix, human approval, the documents, the PDF, the submission buffer.

| Checkpoint | If missed |
|---|---|
| A · end of Phase 2: thin loop + code checks | Finish the loop before starting any AI work |
| B · end of Phase 5: full workflow | Drop the second-opinion pass and logo check. Brand setup shrinks to edit screens plus pasted-text import |
| Wednesday afternoon: all ten features | Insights falls back to two tables. No stretch items |
| Wednesday night: feature freeze | Hard stop. Unfinished items go into the change log as partial |

**Deadline guide:** Phase 5 done by Tuesday night keeps Wednesday free for setup, insights and packaging.

---

## 8. Reliability plan

- Unit tests for every code check, the proof check, routing and fingerprints
- One end-to-end test of the judge path
- Scored test set with published numbers, run at least twice so the trend is visible
- Stored results so the same draft always shows the same findings
- Back-off and retry on rate limits, daily caps per workspace and overall, clear message when a cap is reached
- Input limits on text length, file type and file size
- Drafts treated as untrusted data in prompts
- Append-only audit trail
- A scheduled ping so the free database does not pause

---

## 9. Who does what

**Aryan:** accounts and keys, follow-up questions to the Round 1 survey respondents (early in the build), testing the live link after each phase, recruiting and running the user tests (after Phase 5), reading the code and every document well enough to explain any decision, the screen recording, the submission.

**Claude Code (AI assistant, disclosed):** code, tests, seed data, documents and PDF drafts, under Aryan's direction and review.

---

## 10. Decision log

| When | Decision | Why |
|---|---|---|
| Mon 16 Nov | Checker built before the setup screens | It is the riskiest and the scored part. The demo starts from a seeded, approved rulebook |
| Mon 16 Nov | Demo workspace with three people to act as, no sign-up | The organisers require that a judge can use the product without help |
| Mon 16 Nov | Sample drafts served from stored results of real runs | The free AI tier is rate-limited. Stored results are part of the Round 1 design |
| Mon 16 Nov | Phases, not clock times | Aryan works around other commitments; only the deadline is fixed |
| Mon 16 Nov | Claude may commit and push to `main` after each working step | Keeps production current and history inside the window |
| Mon 16 Nov | Events, comments, decisions and approvals are written by the server only | Direct database writes could forge someone else's name or fake the disputes that Insights counts |
| Mon 16 Nov | Insights sample history lives in code, labelled "sample", never in the database | The page is useful on a first visit without polluting drafts, approvals or the audit trail |
| Mon 16 Nov | Unclear-rule flag: 2 overrides or 3 disputes, and at least 25% of the rule's findings | Simple enough to explain on the page; pushback before the manager's last review stops counting |
