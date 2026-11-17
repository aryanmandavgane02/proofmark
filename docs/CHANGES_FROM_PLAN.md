# Changes from the Round 1 plan

Proofmark was built in Round 2 (16–19 Nov 2026) from the plan submitted in Round 1 (`docs/round1/`). This page lists what was built against that plan, what changed and why. Every decision is also in the decision log in `docs/PLAN.md`.

## Feature status against the Round 1 plan

| Round 1 feature | Priority | Status | Notes |
|---|---|---|---|
| Brand setup and rulebook | Core | Done | PDF import: AI drafts numbered rules; code confirms each quote is really in the PDF and corrects page numbers. The manager approves, edits or rejects, then publishes a numbered rulebook version |
| Fact ledger, glossary, assets | Core | Done | Facts with source, owner, expiry and a confidential flag; preferred and banned terms; colour palette and logo |
| Text and image intake | Core | Done | Text with channel; PNG, JPEG or WebP up to 4 MB with alt text; large photos resized in the browser |
| Code checks | Core | Done | 13 checks: terms, disclaimers, brand colours, alt text, reading level, capitals, pressure language, hashtags, emoji, numbers against facts (including expired facts), superlatives, health and absolute claims. Reading level uses one sentence-length limit (25 words) on every channel; per-channel limits are planned for Round 3 hardening |
| AI checks | Core | Done | Tone, messaging and claims (text); logo use, text inside images and alt-text suggestion (images). Google Gemini, as planned |
| Proof check and labels | Core | Done | AI findings must quote real text and cite an approved rule that applies to the channel. Labels: verified by code, AI verified, needs human judgment |
| Explained findings and fixes | Core | Done | Quote, rule with source page, reason, before-and-after fix. Accept, edit by hand, or dispute |
| Review workflow | Core | Done | Creator, brand manager and two reviewers; routing by risk (claims to legal, visual to design); comments per finding; version history with differences; override with reason; approval tied to the exact version; audit trail |
| Insights | Core | Done, one change | Repeated mistakes by rule, **category** and channel (see below); rules flagged as unclear with AI-proposed clearer wording; claims without a fact; decisions kept as test cases |
| Privacy and AI disclosure | Core | Done | Access rules enforced in the database (22 automated checks); code-checks-only mode; "AI & data" page |
| PDF documents as a format | Stretch | Round 3 | Named improvement |
| Outdated-content alerts | Stretch | Round 3 | Named improvement |
| Rule-change replay | Stretch | Round 3 | Named improvement. Its input, decisions stored as test cases, already exists |
| Check API | Later | Not started | After the event |

## What changed, and why

| Change | Why |
|---|---|
| Built the checker before the setup screens. The demo starts from a seeded, approved rulebook | The checker is the riskiest and the scored part. Setup screens came once the loop worked |
| Demo workspace with four people to act as (creator, brand manager, legal reviewer, design reviewer) and no sign-up | The organisers require that a judge can use the product without help |
| Two reviewers instead of one reviewer role | Routing by risk is clearer when claims go to legal and visual findings go to design |
| Checks use the latest **published** rulebook version | Edits and imports should not change results until the manager publishes them, and every check records its version |
| Workflow records (check results, findings, decisions, comments, approvals, audit events) are written only by the server | Testing showed that writing to the database directly could bypass the workflow or forge someone else's name. The database now refuses these writes from visitors |
| Findings based on what the AI saw in an image (text in the picture, logo use) are always labelled "needs human judgment"; colour findings are measured by code | The proof check can confirm a text quote, but not what an AI saw in a picture |
| The brand-colour check skips photographs | Photos are full of non-brand colours; checking them produced false findings |
| Insights show mistakes by **category** instead of by **team** | The demo has one creator team (the agency), so a team view would show one row. The data model keeps the person on every decision, so a team view can be added |
| Insights include a labelled sample history | The page is useful on a first visit. It is kept in code, marked "Sample", and never mixed into drafts or the audit trail |
| AI findings for unchanged text are reused after a fix is accepted | Saves AI requests and keeps results stable between versions |
| Stored AI results keyed on the exact prompt, with daily caps per workspace and overall | The free AI tier is rate-limited; the same draft always gets the same findings |
| Server functions moved to Mumbai (Vercel region bom1) | They were running in the US, far from the database in India; starting the demo took about 6 seconds |
| Next.js "cache components" turned off | Not needed for this app, and it required extra loading wrappers around every page that reads the session |
| A daily keep-alive job | The free database pauses after a week without activity |
