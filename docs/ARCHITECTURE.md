# Architecture

Proofmark is one Next.js application on Vercel with a Supabase Postgres database, both in Mumbai. The AI model is called
only from the server. Code checks always run first; the AI handles only what code cannot judge, every AI finding must pass
a proof check before anyone sees it, and a person always makes the final decision.

```
Browser ──► Next.js 16 on Vercel (Mumbai, bom1): server-rendered pages and server actions
             │
             ├─► Check pipeline (src/lib/pipeline.ts)               ── answered at once ──
             │     1. Code checks          src/lib/checks/*          14 checks, no AI, milliseconds
             │     2. Image colours         sharp                     brand palette, contrast
             │     3. Save the run and the code findings, mark the AI part "running", return the page
             │                                                        ── then in the background (Next.js after()) ──
             │     4. AI text review        Gemini, 1 request         ┐ 40-second budget for steps 4–7,
             │     5. Proof check           code verifies each finding│ answers stored by exact prompt,
             │     6. Second opinion        Gemini, tone/messaging    │ daily caps per workspace and overall
             │     7. Pictures              Gemini: an image ad, or   ┘
             │                              the 4 largest pictures of a PDF
             │
             ├─► PDF reader (src/lib/documents/)   pdf.js through unpdf: text, fonts and pictures per page
             ├─► Alerts (src/lib/alerts*.ts)        which approved content relies on a fact; re-check by code
             ├─► Replay (src/lib/replay*.ts)        past decisions judged under the current and the new wording
             │
             └─► Supabase (Mumbai, ap-south-1): Postgres with row-level security, anonymous sign-in,
                 private storage (images, documents)
```

## The check pipeline

`runChecks` in `src/lib/pipeline.ts` runs for every new version of a draft.

1. **Load the brand.** Rules come from the latest *published* rulebook version, so edits and imports change nothing until
   the brand manager publishes. Facts, terms, colours and typefaces are read through the visitor's own access rules, so
   confidential facts never reach a creator's check or an AI prompt.
2. **Code checks** (`src/lib/checks/`): numbers against the fact ledger (including expired facts and their replacement),
   superlatives, health and absolute claims, offer disclaimers, glossary terms and product names, reading level per
   channel, capitals, pressure language, hashtags, emoji, alt text, brand colours, and brand typefaces in PDFs. Every code
   finding has a quote, a position, a rule and where possible a fix; applying each fix clears its own finding (25 of 25 in
   the scored test set).
3. **Answer at once.** The run and the code findings are saved and the page is returned. The AI part is scheduled with
   Next.js `after()`, so the page never waits for it. While it runs, the draft page says so and refreshes itself, one
   request at a time (a fixed timer once piled refreshes up behind a slow server and held people's clicks). A run still
   "running" after 90 seconds is closed as done without AI.
4. **AI text review:** one Gemini request with the rules code cannot check, the approved non-confidential facts and the
   draft, marked as data, never instructions. It returns findings with quotes and fixes, and the draft's intent (goal,
   audience, call to action), which the creator confirms. Judgment rules carry an example of a violation and of text that
   is fine.
5. **Proof check** (`src/lib/checks/proof.ts`): an AI finding is dropped unless its quote is really in the draft and its rule
   exists, is approved, is checkable by AI and applies to the channel; and it must not duplicate a code finding of the same
   category. A suggested fix is withheld if applying it would create new code findings.
6. **Second opinion:** tone and messaging findings go to a second, independent request that sees only the phrase, its
   sentence and the rule. If it disagrees, the finding is labelled *needs human judgment*.
7. **Pictures.** An image ad: Gemini reads the text in it (run through the same code checks), checks logo use against the
   reference logo and suggests alt text. A PDF: its 4 largest distinct pictures are taken out of the file
   (`src/lib/documents/pictures.ts`) and Gemini reads their words, which are checked against the claims and terminology
   rules only (deck photos' capitals and colours are not marketing copy). Findings about what the AI saw are always
   *needs human judgment*.

The whole AI part has a 40-second budget (each request 25 s, one retry on overload, then a fallback model). If the AI is
unavailable, over its daily cap, too slow or turned off ("code checks only"), the code findings stand, the page says why in
one sentence, and the creator can run the checks again. After a fix is accepted, AI findings for unchanged text are reused
instead of asking again.

## Improvement 1: PDF documents and decks

- **Upload:** the browser asks the server for a one-time signed link and puts the PDF straight into the private
  `documents` bucket (Vercel accepts request bodies of only about 4.5 MB). The server then checks the path belongs to the
  visitor's workspace, reads the file and refuses, with the exact reason, anything it cannot check: not a PDF, over 100
  pages or 15 MB, password-protected, a scan with no text, damaged, or over 60,000 characters. A workspace may start 40
  uploads a day.
- **Reading** (`src/lib/documents/read.ts`): pdf.js gives each page's text pieces and its drawing operations. From the
  operations the reader takes the glyphs each page actually draws (to give letter-spaced words back their real spaces),
  the real font names, and the pictures. It rebuilds lines: wrapped lines join, headings and code lines stay apart,
  superscripts stay on their line. Scans with a hidden text layer are recognised, and their fonts are not judged.
- **Checking:** the pages are joined into one text with a page map, so every existing text check runs unchanged (an offer
  on page 3 with "T&C apply" on page 10 is not a false alarm), and each finding is given its page. A new code check (VIS-03)
  compares every font with the brand typefaces, one finding per font naming its pages. The AI reviews the whole document
  in one request with page markers.
- **Approval** records the file's SHA-256 and re-hashes the stored file at that moment; the record links to that exact
  file. PDFs are opened through the app with a fresh five-minute link.

## Improvement 2: outdated-content alerts

- **Detection** (`src/lib/alerts.ts`, pure and unit-tested): which approved versions relied on a fact. Number facts are
  found with the same number reader as the facts check, matched by unit and keywords, so "35,000+ customers", "35k
  customers" and "35,000 families" all count, and "1,200 buyers" (another fact) does not. Text facts and offers are found
  by their keywords.
- **Triggers** (`src/lib/alerts-server.ts`): a fact edit that changes a number fact's value or a text fact's wording (a wording-only edit of a number
  fact raises nothing); an end date set or passed.
  Passed dates are raised when the app is next opened, so no scheduled job is needed. One alert per approved version,
  fact and trigger, stored with the old and new wording and the quotes as evidence. Confidential facts never raise alerts,
  because alerts are shown to creators.
- **Re-check:** code checks only (numbers and dates are what changed), so it is instant and needs no AI. A finding on the
  fact withdraws the approval and sends the draft back to its owner, who is notified; a quote still backed by the facts
  closes the alert as still correct; wording only a person can judge waits for a reviewer.
- **History** (`src/lib/fact-history.ts`): each fact's changes, who made them and when, and what happened to each draft.

## Improvement 3: rule-change replay

- **Cases** (`src/lib/replay.ts`, pure and unit-tested): every past finding on the rule that a person acted on. Accepted or
  upheld means it should be flagged; overridden means it should pass.
- **Judging** (`src/lib/ai/replay.ts`): each case is judged under the current and the new wording, one request per
  wording. The AI never sees what people decided or why, so the agreement numbers cannot be copied from them.
- **Result:** for every case, "would now pass", "would now flag" or "unchanged"; the count that would change; agreement
  with people's decisions before and after; and in plain words whether the new wording fits better, the same, or worse.
- **Publishing** is two-step: the replay is always shown first, and it is stored with the rulebook version it was published
  as. Rules checked only by code are not replayed, and the page says why.

## Review workflow

Draft states: draft → in review → approved, or changes requested. Submitting routes by risk: claims go to the legal
reviewer, visual findings to the design lead, everything else to the brand manager; the page shows the steps and whose
turn it is. Open blockers, disputes and upheld findings block approval. An approval records the exact version or file, a
fingerprint, the rulebook version, any overrides and the AI services used. Editing an approved draft, or an outdated fact,
withdraws the approval.

## Data model

Tables (`supabase/migrations/`, 0000 to 0015): `workspaces`, `people`, `members` (who is acting as whom), `rules`,
`rulebook_versions` (published snapshots), `facts`, `terms`, `assets` (colours, logo, typefaces), `imports`, `drafts`,
`draft_versions` (text or a stored file with its pages, fonts and SHA-256), `check_runs`, `findings` (with a page),
`decisions`, `comments`, `approvals` (with the file's SHA-256), `events` (audit trail), `rule_proposals`, `rule_replays`,
`fact_alerts`, `notifications`, and two server-only tables, `check_cache` (stored AI answers) and `ai_usage` (daily caps).
Every column the app filters by, and every foreign key, has an index (0014); the grants Supabase's roles need are explicit
(0015).

## Security model

- **Row-level security** on every table: a visitor sees only their own workspace; creators cannot see confidential facts.
- **Server-only writes for anything that decides an outcome:** check runs, findings, draft status, versions, decisions,
  comments, approvals, alerts, notifications, replays and audit events are written by the server after it has checked
  the visitor's role and the draft's state. The database refuses these writes from visitors; `npm run rls-check` runs 32
  such attacks and expects each to be refused.
- **Files:** images and PDFs are in private buckets; visitors cannot list, download or upload without a link the server
  issues, and only after an access check. A file a version uses is never deleted by a repeated upload.
- **Inputs** from addresses and forms are looked up in fixed lists (never as paths or built-in names); drafts are untrusted
  data in every prompt, and the scored test set includes a prompt-injection case.
- **Keys** (AI and the service key) stay on the server. The audit trail is append-only.

## The hardest problems

1. **Reading real decks faithfully.** pdf.js splits letter-spaced headings into single letters and invents spaces where
   glyphs are spaced out. The reader rebuilds words from the glyphs each page actually draws, but only where the page draws
   real space glyphs, and every reader change is compared before and after on 11 PDFs, so a fix for one export tool does
   not break another.
2. **Never letting the AI hold the page.** Background AI with one budget, one refresh at a time, stored answers, and a
   plain message for every way the AI can fail.
3. **Finding every approved draft that relied on a fact,** however it was phrased, without false alerts. Measured on a
   held-out set written by an independent labeller (a separate AI agent that never saw the code) before the first run (first 60%, now 90% found, 100% precision).
4. **Measuring a rule change honestly.** The replay's judge never sees the human decisions it is compared with.

## Reliability and operations

- Unit tests (Vitest), browser tests (Playwright) on Chrome, Safari's engine, Firefox and phone sizes, a crawl of every
  page as every person, accessibility checks, database attack tests and a scored test set: see [TESTING.md](TESTING.md).
- Daily caps of 60 AI requests per workspace and 450 overall (environment variables `AI_WORKSPACE_DAILY_CAP` and
  `AI_GLOBAL_DAILY_CAP`); every sample's AI answers are stored, so a judge's first checks need no AI request.
- A daily GitHub job checks the live site and its database (`/api/health`), which also stops the free database from
  pausing.
