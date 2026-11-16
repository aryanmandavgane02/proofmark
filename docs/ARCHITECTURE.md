# Architecture

Proofmark is one Next.js application on Vercel with a Supabase Postgres database. The AI model is called only from the server. Code checks always run first; the AI handles only what code cannot judge, and every AI finding must pass a proof check before anyone sees it.

```
Browser ──► Next.js on Vercel (Mumbai, bom1)
             │  pages (server-rendered) and server actions
             │
             ├─► Check pipeline (src/lib/pipeline.ts)
             │     1. Code checks            src/lib/checks/*        (no AI, ~2 ms)
             │     2. Image analysis         sharp: colours, contrast
             │     3. AI text review         Gemini, 1 request       ┐ stored by exact prompt,
             │     4. Proof check            code verifies each AI   │ daily caps per workspace
             │                               finding                 │ and overall
             │     5. Second opinion         Gemini, tone/messaging  │
             │     6. AI image review        Gemini, logo + text     ┘
             │
             └─► Supabase (Mumbai): Postgres with row-level security, anonymous auth, private file storage
```

## The check pipeline

`runChecks` in `src/lib/pipeline.ts` runs for every new version of a draft.

1. **Load the brand.** Rules come from the latest *published* rulebook version, so edits and imports change nothing until the brand manager publishes. Facts, terms and colours are read through the visitor's own access rules, so confidential facts never reach a creator's check or an AI prompt.
2. **Code checks** (`src/lib/checks/`): numbers against the fact ledger (including expired facts and the replacement fact), superlatives, health and absolute claims, offer disclaimers, glossary terms and product names, reading level, capitals, pressure language, hashtags, emoji and alt text. Every code finding has a quote, a position, a rule and, where possible, a fix. A unit test confirms each fix clears its own finding.
3. **Images**: sharp finds the dominant colours and compares them with the brand palette (CIE76 colour difference in Lab space), and skips photographs. Gemini reads text in the image, checks logo use against the reference logo and suggests alt text. Text read from an image is run through the same code checks. Image-derived findings are always labelled "needs human judgment".
4. **AI text review**: one Gemini request with the rules that code cannot check, the approved non-confidential facts and the draft (marked as data, never instructions). It returns findings with quotes and fixes, and the draft's intent (goal, audience, call to action), which the creator confirms.
5. **Proof check** (`src/lib/checks/proof.ts`): an AI finding is dropped unless its quote is really in the draft, its rule exists, is approved, is checkable by AI and applies to the channel, and it does not duplicate a code finding. A suggested fix is withheld if applying it would create new code findings. Dropped findings are counted and shown under "How this was checked".
6. **Second opinion**: tone and messaging findings go to a second, independent request that sees only the phrase, its sentence and the rule. If it disagrees, the finding is labelled "needs human judgment".
7. **Store**: the check run, its findings, the rulebook version, the model and a fingerprint of the content are saved. After a fix is accepted, AI findings for unchanged text are reused instead of asking the AI again.

If the AI is unavailable, over its daily cap or turned off ("code checks only"), steps 3 to 6 are skipped, the page says so, and the code findings still appear.

## Review workflow

Draft states: draft → in review → approved, or changes requested. Submitting routes the draft by risk: claims go to the legal reviewer, visual findings to the design lead, everything else to the brand manager. Open blockers, disputes and upheld findings block approval. An approval records the exact version, the content fingerprint, the rulebook version, any overrides and the AI services used. Editing an approved draft withdraws the approval.

## Data model

Main tables (`supabase/migrations/`): `workspaces`, `people`, `members` (who is acting as whom), `rules`, `rulebook_versions` (published snapshots), `facts`, `terms`, `assets`, `imports`, `drafts`, `draft_versions`, `check_runs`, `findings`, `decisions`, `comments`, `approvals`, `events` (audit trail), `rule_proposals` (Insights), and two server-only tables, `check_cache` (stored AI answers) and `ai_usage` (daily caps).

## Security model

- **Row-level security** on every table: a visitor sees only their own workspace. Creators cannot see confidential facts.
- **Server-only writes for anything that decides an outcome**: check runs, findings, draft status, versions, decisions, comments, approvals and audit events are written by the server after it has checked the visitor's role and the draft's state. The database refuses these writes from visitors, so the workflow cannot be skipped by calling the database directly. `npm run rls-check` runs 22 such attacks and expects each to be refused.
- **The audit trail is append-only**: there is no update or delete policy.
- **AI keys and the service key stay on the server.** Uploaded images are in a private bucket and shown through short-lived signed links.
- **Drafts are treated as untrusted data** in every prompt. The scored test set includes a prompt-injection case.

## Brand setup and Insights

- **PDF import** (`src/lib/ai/import.ts`, `src/lib/checks/import-verify.ts`): unpdf extracts text page by page; one Gemini request drafts small rules with a quote and page; code confirms every quote is in the document, corrects page numbers and drops duplicates. The brand manager approves and publishes.
- **Insights** (`src/lib/insights.ts`, pure and unit-tested): findings are merged across re-checks of the same draft. A rule is flagged as unclear at 2 overrides or 3 disputes, when that is at least 25% of its findings. Gemini proposes clearer wording from the decisions and reasons; accepting it publishes a new rulebook version. Every human decision is also kept as a test case (accepted or upheld means "should flag", overridden means "should pass").

## Reliability

- Unit tests (Vitest) for every code check, the proof check, colours, image findings, import verification and insights. Browser tests (Playwright) for the judge path, image ad, review workflow, brand setup and insights, run against production after each deploy.
- Scored test set (`eval/`, `npm run eval`): results in `eval/RESULTS.md`.
- AI calls: 25-second timeout, one retry after a pause on rate-limit or overload errors, then a fallback model, stored answers keyed by the exact prompt, daily caps of 60 requests per workspace and 450 overall.
- A daily GitHub job checks the live site and its database (`/api/health`), which also stops the free database from pausing.
