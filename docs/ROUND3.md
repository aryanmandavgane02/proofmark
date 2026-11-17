# Round 3 preparation

What the Round 1 plan committed to for Round 3, where each piece starts in the code, and the known gaps found while checking Round 2. Written at the end of Round 2 so Round 3 can start immediately.

## What Round 1 promised for Round 3

| Phase | Share | Promise (Round 1 wording, shortened) |
|---|---|---|
| 7 · Three improvements | 50% | PDF documents as a format, outdated-content alerts, rule-change replay. If Round 2 feedback shows a bigger need, swap one and say why. **Each with a before-and-after demonstration and a number.** |
| 8 · Hardening | 30% | Error handling, retries, access-rule tests, an accessibility audit of Proofmark's own screens, reliability scores tracked over time. **Test-set scores have improved and are charted.** |
| 9 · Finish | 20% | Final report, **demonstration video**, known limitations, roadmap, contribution details. |

Round 2 user testing confirmed all three improvements (see `USER_TESTING.md`); none is swapped.

## The three improvements: starting points

### 1. PDF documents and decks as a content format (text and fonts; up to 20 pages; decks exported as PDF)
- **Already there:** `src/lib/ai/import.ts` reads PDF text page by page with unpdf (used for brand-guide import). The check pipeline (`src/lib/pipeline.ts`) checks a body of text.
- **Plan:** a `document` channel; store the PDF in the private bucket; run the code checks and AI review per page; findings carry a page number; extract font names per page (pdf.js `getOperatorList` / font objects) and compare with the brand typefaces (new asset kind `font`).
- **Measure:** add 10+ PDF cases to `eval/cases.ts`; publish recall and precision for PDFs.
- **Demo:** a 10-page Urja Bites deck (generated like the brand guide) with planted problems on known pages.

### 2. Outdated-content alerts
- **Already there:** findings store `fact_code`; approvals store the version and fingerprint; facts have `expires_on` and edits are logged.
- **Plan:** when a fact is edited or expires, find approved versions whose text matched the old value (numbers via `extractNumberClaims`, plus `fact_code` on past findings); list them on the fact and on Insights; one click re-checks a draft against the new fact; notify the draft owner (in-app).
- **Measure:** "editing F-12 lists N of N approved drafts that quoted the old figure" (recall 100% on a seeded set).
- **Note:** Round 3 runs 21–24 Nov 2026, before fact F-13 (Diwali offer) expires on 30 Nov. Demonstrate expiry by having the brand manager set F-13's expiry date to an earlier day on the Facts page.

### 3. Rule-change replay (rules checked by AI, whose behaviour depends on their wording)
- **Already there:** decisions are stored as labelled test cases (`src/lib/insights.ts`, `testCasesJSON`, `/app/insights/cases`); proposals are in `rule_proposals`; the AI review and code checks are pure enough to re-run.
- **Plan:** before publishing new wording, re-run the affected rule (code check, or AI check with the new statement) on every stored case for that rule; show "would now pass / would now flag" and the count that changes; store the replay with the published version.
- **Measure:** number of past decisions replayed and agreement with human decisions, before and after rewording (e.g. MSG-01 with the sample history).

## Hardening backlog (found during the Round 2 recheck)

| Gap | Where |
|---|---|
| Reading level per channel: averages are configured (`max_avg_words`) but only the 25-words-per-sentence limit is enforced | `src/lib/checks/style.ts` `readabilityCheck` |
| No mock AI provider; AI paths are tested end to end against Gemini | `src/lib/ai/provider.ts` |
| AI judgment false alarms on MSG-01 / MSG-02 (clean controls 3/5 with AI) | `eval/RESULTS.md`; prompt in `src/lib/ai/review.ts` |
| Insights by team (the person is stored on every decision; the demo has one team) | `src/lib/insights.ts` |
| Logo side-by-side comparison for visual findings (user tester 3) | draft page, `src/lib/checks/image-findings.ts` |
| Rule check parameters are not editable on screen; rulebook has no filter | `src/app/app/rulebook/page.tsx` |
| "Where do I start" for first-time users (user tester 1) | Start here page |
| Score history chart for the test set (Round 1 promise) | `eval/history.json` |

## Finish checklist
- Demonstration video (judge path, then each improvement before and after)
- Final report PDF (built like `round2/` with `build.sh`)
- Updated README: Round 3 features, scores over time, limitations, roadmap, contribution
