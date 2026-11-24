# Testing

How Proofmark was tested in Round 3, what the tests found, what was fixed, and what is still imperfect. Numbers are from
the final runs on Tue 24 Nov 2026.

## At a glance

| Layer | Result | Command |
|---|---|---|
| Unit tests (Vitest) | **173 passing** in 14 files | `npm test` |
| Browser tests (Playwright, Chrome) | **61 tests** in 16 files: 60 pass against the live site and locally; the AI-trouble test runs against a local server with the AI turned away | `npx playwright test` |
| Other browsers and phones | The 12 main journeys in Safari's engine (WebKit), Firefox, and at iPhone 14 and Pixel 7 sizes: **48 of 48** on GitHub Actions against the live site; **36 of 36** locally (Safari's engine, iPhone, Android; Firefox does not start on the development Mac) | `ALL_BROWSERS=1 npx playwright test --project=safari --project=firefox --project=iphone --project=android`, or the "Cross-browser" workflow |
| Every page as every person | 22 pages per person (12 pages, plus draft pages with versions and approval records), as each of the 4 people, at 1280 and 375 px wide, and every internal link (38 to 43 per person): no console errors, no "undefined" or "NaN", nothing wider than a phone, no failing link | part of `npx playwright test` (`e2e/crawl.spec.ts`) |
| Accessibility | Every screen passes axe (WCAG 2.1 A and AA) with **zero violations**; the demo works by keyboard alone; no page scrolls sideways at phone width | `e2e/accessibility.spec.ts` |
| Database and storage attacks | **32 of 32 refused**, plus 2 checks that people can see what they should | `npm run rls-check` |
| Scored test set | Code: **100% found, 100% precision**. Code + AI: **97% found, 98% precision**. PDFs: **100% / 100%**. Alerts: **5 of 5**, held-out set **90% / 100%**. Replay: **3 of 5** decisions change, agreement **2 of 4 → 4 of 4**. Details in [eval/RESULTS.md](../eval/RESULTS.md) | `npm run eval` (`-- --code` for code only) |
| Continuous integration | Typecheck, lint and unit tests on every push (GitHub Actions), and Vercel builds and deploys every push; a daily check that the live site and database answer | `.github/workflows/` |

## Where the tests run

- **The live site** (https://proofmark-flame.vercel.app): the full browser suite during Round 3, and from 23 Nov only short
  checks of the key journeys, to keep the free database's disk budget for judging.
- **A separate test database** (a second Supabase project, from 23 Nov): every full run, the cross-browser runs and the
  scored test set's fresh AI runs. Setting it up from the README is how missing database grants were found (below).
- **Locally** against `npm run dev`, with three parallel workers (the development server builds pages on demand).

## What is tested

**The three Round 3 improvements**
- *PDF documents and decks:* a 10-page deck checked page by page; the reviewer approves the exact file (its SHA-256 is
  checked again); the same file uploaded twice, then a corrected PDF as version 2; words inside a deck's pictures read and
  checked, on their page; files that cannot be checked refused with the reason (not a PDF, over 100 pages, password-protected, a
  scan with no text, damaged, empty; the 15 MB limit is checked before the upload starts, but has no browser test); the full review journey ending with the corrected file approved.
- *Outdated-content alerts:* editing F-12 lists every approved draft that quoted it and one click re-checks it; setting an
  offer's end date; an offer that already ended; the same re-check from two tabs happens once; a wording-only change raises
  nothing; a confidential fact never raises alerts creators could read; editing an alerted draft settles its alert; the
  fact's history shows the change and each draft's outcome.
- *Rule-change replay:* clearer wording for MSG-01 is replayed against every past decision before it is published; the AI
  proposes wording from the sample decisions; an edited AI rule in the rulebook is replayed before its version is
  published; real disputes and overrides flag a rule.

**The reliability matrix** (bad input, empty states, refresh, the same action twice, stale tabs, AI trouble)
- Script tags, HTML, Hindi, emoji and a 350-letter word, shown as plain text; unknown addresses and another visitor's draft
  give a friendly "does not exist" page; built-in names such as "constructor" in an address are ignored.
- A reason with no real words is explained; fact form problems are explained and what was typed is kept; files that are not
  PNG, JPEG or WebP are refused with a message; empty states say what to do next.
- The same form submitted twice makes one draft; a fix accepted twice or refreshed makes one version; approving or publishing
  from two tabs happens once; the same comment twice is saved once; a corrected PDF sent twice keeps its file.
- A fix accepted in another tab, and an action as the wrong person, are explained, never silently repeated.
- Text typed before a page finishes loading is kept; an action still running after 10 seconds says so and recovers; while
  the AI runs, the page refreshes one request at a time even when the server is slow.
- AI turned away: code findings are shown, the reason is stated, and the checks can be run again.

**The main journey and the rest of the product:** the judge path (draft in, cited findings out, a person approves); the full
workflow (revision, dispute, comment, approval, re-approval after an edit); image ads (logo beside the approved logo, AI
alt text); brand setup from a PDF; rule settings edited on screen; copy and print of an approved draft; Start here and home
page shortcuts to each improvement, as the right person; switching person; Back; starting over.

## Real-world material

- **Real decks** (Phase 6): five real decks exported from Keynote (45 pages), Chrome (9), PowerPoint (58), Canva (19) and
  Google Slides (67), read in 0.2 to 1.4 seconds. They found the biggest reading problems (below). Course decks with other
  people's names were read on the development machine only, never uploaded or sent to the AI.
- **Reader changes are compared before and after** on 11 PDFs (the 5 real decks, the samples and the fixtures): only the
  intended lines may change.
- **User tests:** five people who had not used Proofmark did four tasks on their own (a deck, a fact change, a rule's
  wording, a post to "Approved"); the two who had not reached "Approved" retried after the changes and both did. See
  [USER_TESTING.md](USER_TESTING.md).

## What testing found, and what was fixed

| Found by | Problem | Fix |
|---|---|---|
| Re-reading the code (Phase 0) | The AI step had no overall time limit: a slow AI could hold a check for about 150 s | A 40-second budget for the whole AI step; code findings always show; the AI runs in the background |
| Browser tests (Phase 2) | A file chosen before the page finished loading never reached the form | The forms read the file input itself |
| Real decks (Phase 6) | 369 and 253 findings on two decks (one per page and per word); letter-spaced labels read as "P R O G R A M"; code joined into a 68-word sentence; "#1" in "Order #1" read as a ranking; offer words found inside other words ("ideal"); "prevents" counted as a health claim; 45- and 58-page decks refused | One finding per font and per group of capitals, naming the pages; words restored from the glyphs each page draws; fixed-width lines kept apart; numbering ignored; whole-word matching; "prevents" needs a health word; limit raised to 100 pages. The same decks then gave 7 to 15 findings, each a real rule hit |
| Full suite on the live site (Phase 6) | Actions (a dispute, a comment, Submit) waited over 20 seconds with no word | Root cause: while the AI ran, the page asked for a refresh every 2 s without waiting for the last, so refreshes piled up ahead of the click. Now one at a time. On the old code, the new test's page never caught up (banner stuck 90 s) |
| Database statistics (Phase 6) | The draft page's reads scanned whole tables, checking access rules row by row (up to 6 s under load) | An index for every filtered column and foreign key (migration 0014); deleting a workspace 1.6 s → 0.3 s |
| Reliability matrix (Phase 6) | A form refused by the server cleared what had been typed; a long word widened the page on a phone | Forms clear only on success; long words wrap |
| Cross-browser runs (Phase 6) | Text typed before load was lost (Firefox); a title typed early was undone (iPhone size) | Fields adopt what is typed before load; every change builds on the latest state |
| Security pass (Block 1) | A corrected PDF submitted twice deleted the file its new version used | A file a version uses is never deleted; a repeat shows what the first made |
| Live use (Tue 24 Nov) | “Yes, start fresh” did nothing when the demo behind the page was gone (its sign-in cleared or expired, or the workspace removed after days unused): the click led back to the same page | It now starts a fresh demo, and the button says “Starting fresh…” while it works; a browser test clears the cookies with the page open and clicks it |
| Fresh setup from the README (Block 2) | On a new Supabase project, even the server was refused ("permission denied"): newer projects no longer grant table access by default | Migration 0015 grants it explicitly, as the live project already had |
| Test database (Block 2) | When the sign-in service refused a new session (an hourly limit), the visitor saw an error page | The home page says why and to try again in a few minutes |
| Judge rehearsal (Block 3) | Links to part of a page hid it under the header, or did not scroll at all when opened directly | Anchors keep room for the header; a small helper scrolls once the page has streamed in |
| Full recheck (Block 3) | `/?demo=constructor` crashed the home page (a lookup also answered to built-in names) | Lookups accept only their own keys, in three places |
| User tests and retest | Testers were unsure whose turn it was, what publishing a rule would do, what follows a re-check, and whether a post had been submitted | Review steps on the draft page; plain explanations at each of those points; a confirmation after "Submit for review" |

## What is still imperfect

- **AI judgment rules.** Two known mistakes in the scored set: the AI flags the opening of a clean offer email for "taste
  first" (labelled *needs human judgment*, because the second opinion disagrees), and it misses "one clear call to action"
  in the draft with many problems. These rules are minor, so they never block approval.
- **Held-out alert sentences:** 2 of 40 still missed ("khajur" for dates, and a list of city names for the stores fact).
- **AI proposals vary when not stored.** On the live site the proposal for MSG-01 is stored, so everyone sees the same one.
  A fresh run proposed different wording that would change none of the 5 decisions; the replay showed that before
  anything was published, which is its purpose.
- **AI service load.** On fresh prompts Gemini sometimes answered "overloaded" or too late. The app then shows the code
  findings, says why, and offers "Run the checks again"; the samples use stored answers.
- **Free hosting tiers.** The free database can slow down when its disk budget runs low; after 10 seconds an action says so,
  with a reload link. All heavy testing moved to the test database to keep the live one's budget for judging.
- **Coverage gaps:** Firefox runs only on GitHub Actions; the AI-trouble test runs only against a local server (the live
  site must keep its AI); logos, colours and photos inside a deck's pictures are not checked (their words are); brand guides
  to import are limited to 4 MB and 40 pages.
- **User testing** was five people, unobserved, mostly people the builder knows, with their own time estimates.
