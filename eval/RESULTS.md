# Scored test set: results

27 hand-labelled drafts for the fictional brand Urja Bites (`eval/cases.ts`): 5 clean controls, 19 with problems code can find (including a prompt-injection case and a draft with ten problems) and 3 judgment cases only AI can find. Run with `npm run eval`. Generated 2026-11-22 07:25 UTC.

| Measure | Code checks only | Code + AI |
|---|---|---|
| Problems found (recall) | 100% | 95% |
| Findings that are real problems (precision) | 100% | 93% |
| Clean drafts with no false alarm | 5/5 | 3/5 |
| Cases fully right (every problem, no false alarm) | 24/24 | 24/27 |
| Code fixes that clear their own finding | 25/25 | 25/25 |
| False alarms shown as “needs human judgment” | no false alarms | 2/3 |
| AI findings dropped by the proof check | — | 13 |
| Average time per draft | 2 ms | 76 ms |

Code-only scores leave out the three judgment cases and the AI-only rules in the many-problems draft, because code cannot check them by design.
AI model: gemini-3.5-flash-lite. AI answers are stored by exact prompt, so a re-run gives the same answers unless a prompt or rule changes.

## PDF documents (Round 3)

3 PDF files, labelled by hand by page and rule before the first run (`DOC_CASES` in `eval/cases.ts`; the files are built by `scripts/make-sample-docs.ts`): deck-diwali (10-page retail deck; problems planted on pages 2 to 9, pages 1 and 10 clean; page 4 set in Georgia); one-pager-clean (Clean control in the brand typefaces); brochure-arial (Two pages set in Arial, an ended offer (fact F-14) and a term to avoid). A finding counts only on the page its label gives; the same rule on another page is a false alarm.

| Measure | Code checks only | Code + AI |
|---|---|---|
| Problems found on the right page (recall) | 100% | 100% |
| Findings on a labelled page and rule (precision) | 100% | 100% |
| Pages in a non-brand typeface found | 3/3 | 3/3 |
| Typeface findings on a page in the brand typefaces | 0 | 0 |
| Clean document with no false alarm | 1/1 | 1/1 |
| Documents fully right | 3/3 | 3/3 |
| AI findings dropped by the proof check | — | 6 |
| Average time per document (reading the PDF included) | 48 ms | 69 ms |

| Document | Expected (page and rule) | Missed | False alarms | Result |
|---|---|---|---|---|
| deck-diwali | p2 CLAIM-01, p3 CLAIM-03, p4 VIS-03, p5 CLAIM-02, p6 DISC-01, p7 TERM-01, p8 TONE-04, p8 TONE-03, p9 TONE-01 | — | — | Pass |
| one-pager-clean | nothing (clean) | — | — | Pass |
| brochure-arial | p1 TERM-01, p1 CLAIM-01, p1 VIS-03, p2 VIS-03 | — | — | Pass |

Code-only scores leave out TONE-01 on page 9 of the deck, which only the AI can judge.
These files were made for the test, with problems planted on known pages. The scores show that reading pages, placing findings on their page, typeface detection and the checks work on PDFs; they do not measure every real-world layout, which varies more between design tools.

## What the failures show

- Code checks were right on every case. They cover numbers, facts, offers, terms, capitals, pressure language, hashtags, emoji, alt text and claims.
- The AI's mistakes are on judgment rules: taste-first (MSG-01) and one call to action (MSG-02). It flagged two clean drafts and missed both rules in the many-problems draft. Two of its three false alarms were already shown as “needs human judgment”, because the independent second opinion disagreed. Tone and messaging rules are minor, so these findings are suggestions and never block approval.
- In the many-problems draft the AI reported only problems the code checks had already found (pressure, ranking, health claim), which the proof check then dropped as duplicates. It did not notice the missing call to action or the missing taste line. When a draft has many loud problems, the AI focuses on them.
- The prompt-injection case passed: an instruction inside the draft did not hide the finding.
- Times are with stored AI answers. A first-time AI answer takes about 1 to 3 seconds per request.

## Label corrections

Labels were written before the first run. Corrections made after a run are listed here, never made silently:

- Instagram and ad cases: alt text is required (A11Y-01). Clean controls given alt text; other cases now expect A11Y-01.

## Every case (code + AI)

| Case | Expected | Missed | False alarms | Result |
|---|---|---|---|---|
| clean-website | nothing (clean) | — | — | Pass |
| clean-instagram | nothing (clean) | — | — | Pass |
| clean-offer-email | nothing (clean) | — | MSG-01 “Our Diwali box is here: six bars of coco” (needs judgment); MSG-02 “Get 20% off the 6-bar box until 30 Novem” | **Fail** |
| clean-linkedin | nothing (clean) | — | MSG-01 “Snacking at work should taste good.” (needs judgment) | **Fail** |
| clean-ad | nothing (clean) | — | — | Pass |
| count-too-high | CLAIM-01 | — | — | Pass |
| expired-offer | CLAIM-01 | — | — | Pass |
| wrong-protein | CLAIM-01 | — | — | Pass |
| wrong-price | CLAIM-01 | — | — | Pass |
| superlative | CLAIM-02, A11Y-01 | — | — | Pass |
| health-claim | CLAIM-03 | — | — | Pass |
| cure-claim | CLAIM-03 | — | — | Pass |
| guarantee | ADV-01 | — | — | Pass |
| missing-tc | DISC-01 | — | — | Pass |
| pressure | TONE-04, A11Y-01 | — | — | Pass |
| shouting | TONE-03, A11Y-01 | — | — | Pass |
| banned-terms | TERM-01 | — | — | Pass |
| brand-name | TERM-01 | — | — | Pass |
| long-sentence | TONE-02 | — | — | Pass |
| too-many-hashtags | SOC-01, A11Y-01 | — | — | Pass |
| missing-hashtag | SOC-01, A11Y-01 | — | — | Pass |
| emoji | SOC-02, A11Y-01 | — | — | Pass |
| preachy | TONE-01 | — | — | Pass |
| protein-first | MSG-01, A11Y-01 | — | — | Pass |
| two-ctas | MSG-02 | — | — | Pass |
| prompt-injection | CLAIM-02 | — | — | Pass |
| many-problems | TONE-04, CLAIM-02, TERM-01, CLAIM-01, CLAIM-03, DISC-01, SOC-01, MSG-01, MSG-02, A11Y-01 | MSG-01, MSG-02 | — | **Fail** |

## History

| When (UTC) | Mode | Recall | Precision | Clean | Fully right |
|---|---|---|---|---|---|
| 2026-11-16 16:59 | code | 100% | 74% | 3/5 | 15/24 |
| 2026-11-16 17:01 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-16 17:02 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-16 17:03 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-16 17:03 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-16 17:03 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-16 17:03 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-16 17:04 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-16 17:04 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-16 17:37 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-16 17:37 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-22 06:36 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-22 06:36 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-22 07:25 | code | 100% | 100% | 5/5 | 24/24 |
| 2026-11-22 07:25 | code+ai | 95% | 93% | 3/5 | 24/27 |
| 2026-11-22 07:25 | pdf code | 100% | 100% | 1/1 | 3/3 |
| 2026-11-22 07:25 | pdf code+ai | 100% | 100% | 1/1 | 3/3 |
