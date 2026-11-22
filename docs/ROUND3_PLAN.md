# Proofmark: Round 3 plan (The finish)

**Team SoloStack (solo: Aryan Mandavgane) · CodeZen 2026 · Round 3, the finale (top 50)**
**Window:** Saturday 21 Nov 2026, 23:59 IST to Tuesday 24 Nov 2026, 23:59 IST (72 hours). No late window.
**Written:** Sunday 22 Nov 2026, inside the window. Work goes phase by phase; the only fixed time is the deadline. Every change is committed and pushed inside the window, so the history shows when the work was done.

AI assistance: planned and built with Claude Code (Anthropic), disclosed in DISCLOSURES.md; commits it helped with carry a `Co-Authored-By` line.

---

## 1. What Round 3 asks, and our answer to each instruction

> "Round 2 proved your idea runs. Round 3 decides whether it is a product. You are not starting anything new and you are not changing direction. A judge will open your link and use it on their own, with nobody from your team explaining anything."

| # | Organisers' instruction | What we do | Phase |
|---|---|---|---|
| 1 | Deliver exactly the three improvements named at Round 2 | Build each against a word-for-word acceptance checklist (section 4) and prove it with a before-and-after number | 2, 3, 4 |
| 2 | Finish the features left open; a half-working feature counts against you more than a declared one | Close every item from our Round 2 "What does NOT work yet" answer, or declare it plainly (section 8) | 5 |
| 3 | Make it hold up without you: bad input, empty state, refresh, the same action twice | Reliability foundations first, then a written reliability matrix that becomes an automated test (section 7) | 1, 6 |
| 4 | Tighten the interface so someone new completes the main journey | A "What's new" path to each improvement, feedback on every action, a page-by-page view for documents | 1, 5, 6 |
| 5 | Test the main journeys end to end and fix what testing finds | Browser tests on Chrome, Safari's engine and Firefox, desktop and phone; full crawl; a second round of user tests | 6 |
| 6 | Someone else must be able to clone the repo and run it from the README | README rewritten and tested from a fresh clone, step by step | 7 |
| + | Organisers' tip (WhatsApp): use a demo account and put its credentials on the website so judges can log in easily | Proofmark needs no login: one click creates a private demo workspace with four ready-made people. A "Demo access" box on the landing page says so plainly (no username or password) and lists the four people and what each can do; the README and PDF repeat it | 1 |

Not required, so not done: no video, no social-media posts. Only the form below.

## 2. How Round 3 is scored, and what earns each point

| Criterion | Points | What a judge checks | Our answer |
|---|---|---|---|
| Completeness of the product | 25 | Features finished, open ends closed, main journeys tested; what is left undone and whether we said so | Every Round 2 open end closed or declared; every journey covered by a browser test; an honest "not done" list |
| The three improvements delivered | 20 | Measured against exactly what we named at Round 2 | Word-for-word checklists; one-click way to try each from Start here; before-and-after numbers in the PDF |
| Reliability under normal use | 20 | Bad input, an empty state, a repeated attempt; nothing breaks or hangs | No silent no-ops, no endless spinners, idempotent actions, AI time limit, background AI, reliability test suite |
| Usability and real-world fit | 20 | The intended user works it out without a walkthrough; practical in its setting | Guided path including the new features, plain feedback, documents and offers that match how Indian D2C brand teams actually work |
| Documentation and roadmap | 15 | Someone else can run it from the repository; the next step is a credible plan | README tested from a fresh clone; ROADMAP with order, users, effort, dependencies and success measures |

## 3. The submission form (exact fields) and where each answer comes from

| Form field | Source |
|---|---|
| Team name, leader, email, members (names used on the certificate) | Same as Rounds 1 and 2 |
| Final working project link | https://proofmark-flame.vercel.app (unchanged URL) |
| Final source-code repository (public, everything pushed) | https://github.com/aryanmandavgane02/proofmark |
| Google Drive link to the final product PDF | Final PDF, built like the Round 2 report, uploaded and tested signed-out |
| The complete list of features (one per line, only what works) | README feature list, checked against the live site |
| Technical architecture and implementation summary (components, data flow, models and APIs, infrastructure, hardest problem) | docs/ARCHITECTURE.md |
| Testing details (what, how, what we found and fixed, what is still imperfect) | docs/TESTING.md (new) |
| Improvements 1, 2 and 3: what we committed to and what we delivered | Section 4 checklists, with the evidence |
| Anything else improved after Round 2 | docs/CHANGES_SINCE_ROUND2.md (new) |
| Product roadmap and future development plan (what next, in what order, for whom, what it takes) | docs/ROADMAP.md (new) |
| Confirmations and declaration | Verified in Phase 8 |

---

## 4. The three promises: acceptance checklists

These are graded against our Round 2 wording. Each box must be true in the live product before we tick it.

### Improvement 1: PDF documents and slide decks as a content format

**We committed to:** a user uploads a PDF of up to 20 pages (a brochure, a one-pager or a slide deck exported as PDF), and Proofmark checks every page against the rulebook with the same code checks, AI checks and proof check as posts, plus a check that fonts are the brand typefaces. Each finding points to its page and quotes the text, and the document goes through the same review and approval as any other draft; a reviewer approves the exact file.

- [ ] Upload a PDF of up to 20 pages from New draft (and a one-click sample deck)
- [ ] Every page is checked: the same code checks, AI checks and proof check as posts
- [ ] Fonts are compared with the brand typefaces; any other font is flagged with its page
- [ ] Every finding shows its page number and quotes the text
- [ ] Same review and approval: dispute, submit, routing by risk, approve, request changes
- [ ] The reviewer approves the exact file: the approval records the file's fingerprint (SHA-256), and the reviewer can open that exact file
- [ ] **Done when:** a 10-page Urja Bites deck is checked page by page; every finding shows its page and quote; fonts outside the brand typefaces are flagged; the scored test set includes PDF cases with published scores

**Evidence for the PDF:** before (a document could only be pasted as text; fonts were never checked) and after (the 10-page deck: findings across its pages, the off-brand font flagged on its page, time taken), plus the PDF test-set scores.

### Improvement 2: outdated-content alerts

**We committed to:** when a fact is edited or expires, Proofmark finds every approved draft that relied on the old value, lists them on the fact and on the Insights page, and notifies each draft's owner in the app. One click re-checks the draft against the new fact and sends it back for approval if it needs changes.

- [ ] Editing a fact's value or wording finds every approved draft that relied on the old value
- [ ] A fact that expires, or whose expiry date the brand manager sets, lists the approved drafts that mention it
- [ ] The list appears on the fact (Facts page) and on the Insights page
- [ ] Each draft's owner is notified in the app
- [ ] One click re-checks the draft against the current facts; if it needs changes, its approval is withdrawn and it goes back for approval; if it is still correct, the alert closes
- [ ] **Done when:** editing fact F-12 (the customer count) lists every approved draft that quoted the old figure, with none missed on a seeded test set, and each can be re-checked in one click; when a fact expires, or the brand manager sets its expiry date (for example the Diwali offer), the drafts that mention it are listed

**Evidence:** before (approved content went out of date silently) and after (editing F-12 found N of N approved drafts that quoted it, with no false alerts, on the seeded set; recall and precision published).

### Improvement 3: rule-change replay

**We committed to:** before publishing new wording for a rule checked by AI, Proofmark replays it against every stored decision for that rule and shows which past findings would now pass and which would now be flagged, with the count that would change. The replay is saved with the published version.

- [ ] Replay runs on the proposed wording, whether the AI drafted it or the manager wrote or edited it
- [ ] Every stored decision for that rule is shown with: the human decision, the result under the current wording, the result under the new wording, and "would now pass", "would now flag" or "unchanged"
- [ ] The count that would change, and agreement with the human decisions before and after
- [ ] Shown before the manager publishes; the replay is saved with the published rulebook version and shown in the version history
- [ ] Rules checked only by code are not replayed, and the page says why (their wording does not change what the code checks)
- [ ] **Done when:** proposing new wording for a flagged rule (for example "taste first", MSG-01) shows "would now pass / would now flag" for every past decision on that rule, with the number that changes and agreement with the human decisions before and after, before the manager publishes

**Evidence:** MSG-01 replay: agreement with human decisions before and after the new wording, and how many would change.

---

## 5. Phases

**Checkpoints (the deadline is fixed; the rest is a guide):**

| Checkpoint | Target |
|---|---|
| A · end of Sunday | Foundations live (Phase 1); Improvement 1 under way |
| B · Monday afternoon | Improvement 1 live and meeting its "done when" |
| C · Monday night | Improvements 2 and 3 live and meeting their "done when" |
| D · Tuesday afternoon | **Feature freeze.** Only fixes after this |
| E · Tuesday evening | Submitted, with at least three hours to spare. No deploys after the final check |

### Phase 0 · Baseline and risk spikes

- [x] Round 3 rules, scoring and the exact form fields read
- [x] Confirmed there are no commits between the Round 2 deadline and the Round 3 start
- [x] Spike: font names per page from a PDF. pdf.js (through unpdf) returns them with `fontExtraProperties`, e.g. page 2 uses "CAAAAA+Georgia"; 16 pages in about 0.1 s
- [ ] Spike: browser uploads a PDF straight to private storage with a signed upload link (Vercel functions accept requests of only about 4.5 MB)
- [x] Background AI: Next.js 16 docs confirm `after()` runs after the response even when the action redirects, and `maxDuration` is set per page for server actions. To be verified on production in Phase 1
- [x] Found while re-reading the code: the AI step has no overall time limit. Each request may wait 25 s per model and falls through to the second model, so a slow AI could hold a check for about 150 s. Phase 1 fixes it
- [x] Baseline: all tests green; scored test set re-run so "before" numbers are recorded (same as Round 2: code 100% / 100%, code + AI 95% / 93%)
- [x] This plan committed

### Phase 1 · Foundations: nothing hangs, every action answers

- [x] **AI time limit** for the whole AI step (text review, second opinion, image review, retries included). When it runs out, code findings show and the page says "AI took too long, run it again"
- [x] **AI in the background:** code findings appear at once; AI findings follow while the page says "AI checks running" and refreshes itself. If the AI has not finished after about 90 seconds, the page says so and offers to run it again. Submit and approve wait until the AI is done. *Fallback if the spike fails: AI in the request, within the time limit, with a clear progress message*
- [x] **Feedback on every action:** a refused action (stale tab, wrong person, already done, too short a reason) shows a plain notice instead of silently doing nothing
- [x] **Same action twice:** creating a draft is idempotent (a token per form); publishing only happens when something changed; one open wording proposal per rule; duplicate comments ignored; double-clicking "Start the live demo" keeps one workspace
- [x] **Loading states** for every app page, so navigation never looks frozen
- [x] Explicit function time limits for the pages that run checks
- [x] **Demo access box** on the landing page (organisers' tip): no login, no password; the four demo people and what each can do
- [x] Tests: the first reliability cases (double submit, stale tab, refresh during a check)

### Phase 2 · Improvement 1: PDF documents and decks

- [ ] Migration: a "Document (PDF)" channel; version fields for the file (path, name, SHA-256, page count, pages with their text ranges and fonts); a page number on findings; a private `documents` storage bucket (PDF only, 15 MB); typefaces as brand assets
- [ ] Brand typefaces: the Urja guide's "Type" page names Poppins (headlines) and Inter (body); new code rule VIS-03 "Brand typefaces" for documents; typefaces listed and editable on the Facts page like colours. The guide PDF is regenerated and its quotes re-verified
- [ ] Upload: New draft offers "Text or image" and "Document (PDF)". The browser uploads straight to storage; the server checks it is a real PDF, at most 20 pages and 15 MB, not password-protected and not a scan without text, and says exactly what is wrong otherwise
- [ ] Reading: text per page, fonts per page, file fingerprint
- [ ] Checking: pages joined with a page map so every existing code check runs unchanged (offers and "T&C apply" work across pages); one AI request for the whole document with page markers, then the proof check and the second opinion; every finding gets its page; font check per page, with names normalised ("AAAAAA+Poppins-Bold" is Poppins) and symbol and emoji fonts ignored
- [ ] Draft page for documents: page-by-page view with highlights; findings show "Page 3" and jump to the page; a page index with findings per page; "Open page 3 in the PDF". No "Accept fix" (a PDF cannot be edited here); instead "Upload a corrected PDF" creates a new version. The approval shows the file fingerprint and opens the exact approved file
- [ ] Samples: a 10-page "Urja Bites Diwali retail deck" generated in the repo with planted problems on known pages and one page in a non-brand font, plus a clean one-pager; one click from New draft and Start here
- [ ] Scored test set: PDF cases with expected (page, rule) pairs; page-level recall and precision and font detection published in eval/RESULTS.md
- [ ] Tests: unit (page mapping, font names, limits); browser (sample deck end to end through approval; corrected upload; bad PDFs: not a PDF, too many pages, too large, password-protected, scanned, empty)
- [ ] Stored AI answers for the sample deck, so it opens instantly for judges

### Phase 3 · Improvement 2: outdated-content alerts

- [ ] An approved-content library seeded in every demo workspace, labelled as sample: approved posts, emails and a deck that quote the customer count in different forms ("35,000+ customers", "35k customers", "over 35,000 happy customers"), two that mention the Diwali offer, and decoys with other numbers. The guided checklist ignores sample drafts
- [ ] Detection (pure and unit-tested): which approved versions relied on a fact, using the same number reader as the facts check, matched by unit and keywords; text facts matched by their keywords
- [ ] Triggers: a fact edit that changes its value or wording; an expiry date that has passed, including one the manager sets
- [ ] Alerts stored with the old and new value, shown on the fact ("Used in 5 approved drafts", red when out of date), on Insights ("Out-of-date approved content") and as an in-app notification for each draft's owner (count in the header)
- [ ] One-click re-check against the current facts: if it needs changes, the approval is withdrawn with the reason, the draft goes to "changes requested" and the owner is told; if still correct, the alert closes as "still correct". Everything lands in the audit trail
- [ ] Measured: recall and precision of detection on the seeded set, published
- [ ] Tests: unit (every phrasing found, decoys not); browser (Meera edits F-12 and sees every affected draft; one click re-checks; Arjun sees the notification; setting F-13's expiry lists the offer drafts)

### Phase 4 · Improvement 3: rule-change replay

- [ ] Replay engine: the cases are the stored decisions for the rule (accepted or upheld means "should be flagged", overridden means "should pass"), each with its context (the draft text for real decisions; channel, draft title and quote for the sample history). One AI request judges every case under the current wording and one under the new wording, at temperature 0, stored by exact prompt so a replay always gives the same answer
- [ ] Result per case, counts, and agreement with the human decisions before and after
- [ ] On Insights: after a proposal or the manager's own wording, "Preview the effect on past decisions"; re-run when the wording is edited; publishing saves the replay with the version
- [ ] Rulebook version history shows each version's replay summary; the publish banner offers a replay for edited AI rules
- [ ] Measured: the MSG-01 replay numbers, published
- [ ] Tests: unit (case building, agreement maths); browser (MSG-01 proposal, replay table, publish, the version shows its replay)

### Phase 5 · Open ends from Round 2, and interface tightening

- [ ] Reading level per channel: the configured average sentence length per channel is enforced
- [ ] Logo findings show the brand's reference logo next to the image
- [ ] Rule check settings editable on screen for code rules (limits, required text, phrases), applied when published
- [ ] Fewer AI false alarms on judgment rules (MSG-01, MSG-02): use each rule's examples and ask only for clear violations; re-run the scored test set and publish the trend
- [ ] Start here: a "New since Round 2" card with one click to each improvement, switching to the right person
- [ ] Approved drafts: "Copy approved text" and a printable approval record
- [ ] Scored-test-set history chart in RESULTS.md

### Phase 6 · Judge-proofing: reliability and usability sweep

- [ ] The reliability matrix (section 7) as an automated test suite against production
- [ ] Main journeys on Chrome, Safari's engine (WebKit) and Firefox, desktop and phone sizes
- [ ] Full crawl of every page as every person on desktop and phone: no errors, broken links, odd text or overflow; accessibility audit at zero violations; keyboard-only path
- [ ] User tests, round 2: three to five people who have not used Proofmark try the main journey and the three improvements with no help; results in docs/USER_TESTING.md; top issues fixed
- [ ] Real-world PDFs: decks exported from Google Slides, Canva and PowerPoint checked, and what we learn fixed or declared
- [ ] AI capacity for the judging period: daily caps sensible; stored answers for every sample, for today's facts and for after the Diwali offer expires on 30 Nov
- [ ] Every finding fixed or declared

### Phase 7 · Documentation, roadmap, final PDF, form

- [ ] README: what Proofmark is; try it in two minutes, including each improvement; complete feature list; run it yourself (prerequisites, Supabase setup, keys, migrate, run, test, deploy, troubleshooting), tested from a fresh clone
- [ ] docs/ARCHITECTURE.md updated: documents, alerts, replay, background AI; components and data flow; the hardest problems
- [ ] docs/TESTING.md: what was tested and how, numbers, what we found and fixed, what is still imperfect
- [ ] docs/ROADMAP.md: what next and in what order, for whom, what it takes (effort, dependencies, cost drivers), how we will know it worked; what we will not build
- [ ] docs/CHANGES_SINCE_ROUND2.md, DISCLOSURES.md updated
- [ ] Final product PDF: links; how a judge tries it; complete features; each improvement before and after with its number; other improvements; architecture; testing; what is not done; roadmap; disclosures. Real screenshots from the live site
- [ ] Form answers drafted to the exact Round 3 fields

### Phase 8 · Freeze, verify, submit

- [ ] Feature freeze; only fixes
- [ ] Final verification: all tests on production, crawl, accessibility, every link signed-out, the PDF opened from Drive, repository public and fully pushed
- [ ] Submitted with at least three hours to spare; no deploys after the final check

---

## 6. Cut order if we fall behind

In this order: rule check settings on screen (declare it) → replay on the Rulebook page (keep it on Insights) → copy and print niceties → background AI (fall back to the time-limited AI in the request) → direct-to-storage upload (fall back to a stated 4 MB limit through the server).

**Never cut:** the three "done when" lists, the nothing-hangs guarantees, the reliability matrix, the fresh-clone README, the final PDF, the form, the buffer before the deadline.

## 7. Reliability matrix (becomes an automated test)

| Kind | Case | Expected |
|---|---|---|
| Bad input | Empty or whitespace-only content; over the length limit | Told plainly; nothing created |
| Bad input | Hindi or Hinglish text, emoji only, HTML or script tags, one very long word | Checked without errors; shown as plain text |
| Bad input | Image that is not an image, a GIF, a huge photo, an empty file | Refused or resized, with a message |
| Bad input | PDF that is not a PDF, over 20 pages, over 15 MB, password-protected, scanned (no text), corrupted, empty | Refused with the exact reason |
| Bad input | Fact with a non-number value, a duplicate code, no source or owner; colour with a bad hex code; empty term | Told what to fix |
| Bad input | A dispute or override reason that is too short | Told why, not silently ignored |
| Bad input | An unknown or another visitor's draft address | Friendly "does not exist" page |
| Empty state | New workspace: review queue, Insights "Yours only", alerts, audit trail, version history with one version, a document with no findings | A helpful message and the next step, never a blank area |
| Refresh | During a check; after accepting a fix; on a form with an error; during a PDF upload | No duplicate, no lost work, the page recovers |
| Twice | Double-click Check, Accept fix, Dispute, Approve, Publish, Propose wording, Re-check alert, Post comment, Start demo, Reset | One result, never two |
| Stale tab | Two tabs as different people; a finding resolved in another tab; a draft approved in another tab | A clear notice, no silent no-op |
| AI trouble | AI slow, unavailable or over the daily limit | Code findings shown, the reason stated, a way to run it again |

## 8. Round 2 open ends: close or declare

| Round 2 "does not work yet" | Round 3 |
|---|---|
| PDFs and decks cannot be uploaded | Closed by Improvement 1 |
| Reading level: one limit for every channel | Close (Phase 5) |
| Fonts and layout in images not checked | Fonts in PDFs closed by Improvement 1; fonts and layout inside images declared, on the roadmap |
| AI false alarms on judgment rules | Reduce and measure (Phase 5); replay helps fix unclear wording (Improvement 3); the remainder declared with numbers |
| AI slow on new text (free tier) | Background AI and a time limit (Phase 1); free-tier speed declared |
| Workspace belongs to the browser that started it | Declared (privacy by design) |
| Logo not shown beside the reference | Close (Phase 5) |
| Rule check settings not editable on screen | Close (Phase 5), or declared if cut |
| No email sign-up or multi-company setup | Declared, on the roadmap |
| Insights by category, not by team | Declared, on the roadmap |

## 9. Risks and what we do about them

| Risk | Mitigation |
|---|---|
| Gemini's free tier is slow or busy while judges test | Stored answers for every sample; background AI; time limit; code findings always shown |
| Real-world decks have messy text order or unusual font names | Test with Google Slides, Canva and PowerPoint exports; font-name normaliser with unit tests; limits declared |
| Vercel request size and function time limits | Direct-to-storage upload; explicit time limits; one AI request per document |
| A change breaks the judge path | Browser tests before every push and against production after deploy |
| Running out of time | Phases in priority order, the cut order above, freeze on Tuesday afternoon |
| The Diwali offer (F-13) expires on 30 Nov while judging may still run | With Improvement 2 this becomes a live demonstration; stored AI answers already cover after that date; the PDF explains it |
| "Built inside the event window" is checked | Commit and push throughout; never rewrite history |

## 10. Who does what

**Aryan:** approve this plan; line up three to five new testers for Tuesday morning; export one or two real decks from Google Slides, Canva or PowerPoint as PDF for testing; optionally create a second free Supabase project so the README can be tested from scratch; read and approve the documents; write the certificate lines himself; upload the PDF, fill in the form, submit.

**Claude Code (disclosed AI assistant):** code, tests, documents and PDF drafts, under Aryan's direction and review.

## 11. Decision log

| When | Decision | Why |
|---|---|---|
| Sun 22 Nov | Order: foundations, then Improvement 1, then 2, then 3 | Improvement 1 is the largest and riskiest, so it gets the most time; it also needs the background AI from the foundations. The font spike removed its biggest unknown |
| Sun 22 Nov | No video | The rules say no video demo |
| Sun 22 Nov | PDFs go straight from the browser to private storage | Vercel functions accept requests of only about 4.5 MB; real decks are often larger |
| Sun 22 Nov | Fonts read with pdf.js (`fontExtraProperties`) | Spike: real names per page, about 0.1 s for 16 pages |
| Sun 22 Nov | Seed an approved-content library in each demo workspace, labelled as sample | Improvement 2 needs approved content to protect, and judges start with an empty workspace |
| Sun 22 Nov | No demo credentials needed; a "Demo access" box explains the one-click demo and the four people | Organisers suggested putting demo credentials on the site; ours has no login, so we make that explicit instead |
| Sun 22 Nov | Background AI shipped (Phase 1); verified on production | A fresh check on production took 29.5 s of AI time (Gemini's free tier was slow, about 15 s per request): judges now see code findings at once instead of a 30 s spinner. Documents will need a longer AI budget than posts |
| Sun 22 Nov | Pages joined with a page map instead of checking pages separately | Every existing check keeps working, and an offer on page 3 with "T&C apply" on page 10 is not a false alarm |
