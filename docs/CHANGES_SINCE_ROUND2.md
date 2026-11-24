# What changed since Round 2

Everything improved in Round 3 (21 to 24 Nov 2026), apart from the three named improvements, which are in the
[README](../README.md#round-3-the-three-improvements). How each part was tested: [TESTING.md](TESTING.md). The working
plan, with every decision and its reason: [ROUND3_PLAN.md](ROUND3_PLAN.md).

## Round 2's "does not work yet", closed or declared

| Round 2 said | Round 3 |
|---|---|
| PDFs and decks cannot be uploaded | **Closed** by improvement 1 |
| Reading level: one limit for every channel | **Closed:** each channel's average sentence length is enforced. Also fixed: sentences were split inside "urjabites.in" and "4.6", which skewed every length check |
| Fonts and layout in images not checked | **Fonts in PDFs closed** by improvement 1; fonts and layout inside images declared, on the roadmap |
| AI false alarms on judgment rules | **Reduced and measured:** code + AI went from 95% found and 93% precision to 97% and 98%; the rest declared with the exact cases ([TESTING.md](TESTING.md)) |
| AI slow on new text | **Closed:** the AI runs in the background with a 40-second budget; code findings show at once |
| Logo not shown beside the reference | **Closed:** a logo finding shows the approved logo beside it |
| Rule check settings not editable on screen | **Closed:** limits, required text and phrases of code rules are edited on screen, validated, and used once published |
| Workspace belongs to the browser that started it | Declared (privacy by design) |
| No email sign-up or multi-company setup | Declared, on the roadmap |
| Insights by category, not by team | Declared, on the roadmap |

## Reliability: nothing hangs, every action answers

- **The AI cannot hold a check.** The whole AI step has a 40-second budget (it could take about 150 s before). Code
  findings appear at once; AI findings follow while the page says so. If the AI is unavailable, over its daily limit or
  too slow, the page shows the code findings, says why in one plain sentence, and offers "Run the checks again".
- **No silent no-ops.** A refused action (a stale tab, the wrong person, already done, too short a reason) shows a plain
  notice instead of doing nothing. An action still running after 10 seconds says so, with a reload link.
- **The same action twice does it once:** creating a draft, accepting a fix, approving, publishing, re-checking an alert,
  posting a comment, uploading a corrected PDF.
- **Actions were held for over 20 seconds on the live site,** because refreshes piled up while the AI ran. Fixed at the
  root: one refresh at a time. A test proves it.
- **Faster database reads:** an index for every filtered column and foreign key (deleting a workspace went from 1.6 s to
  0.3 s); setting up a demo is about 20% faster.
- **Forms keep what was typed** when the server refuses it, and when it was typed before the page finished loading.
- **Errors say what happened:** a demo that cannot be started explains why on the home page; unknown addresses give a
  friendly page; a corrected PDF submitted twice can no longer delete the approved file.
- **Loading states** on every page, and explicit time limits for the pages that run checks.

## Usability: a newcomer finds the way alone

- **The three improvements are one click from the home page,** before a demo even starts, and come first on Start here,
  each opening as the right person.
- **"Demo access" box on the landing page:** no login and no password; the four demo people and what each can do (the
  organisers' tip). The demo banner says that "Acting as" switches person in the same workspace and who does what.
- **Whose turn it is:** the draft page shows three review steps (Fix and submit, Review, Approved) and who acts now;
  "Submit for review" confirms it and names the next reviewer.
- **Plain explanations where testers hesitated:** what publishing new wording changes (and that past approvals stay); what
  follows a re-check; findings about the whole post say so ("Missing: hashtags" rather than a cut-off quote); the font and
  ranking findings in plain words.
- **Approved drafts:** "Copy approved text" and a printable approval record.
- **Links to part of a page** land below the sticky header, also when opened directly; a shorter banner on phones; a link
  preview card when the site's link is pasted into a chat or an email.

## Accuracy

- **AI judgment rules:** each gives the AI an example of a violation and of text that is fine, and asks only for clear
  violations (code + AI precision 93% → 98%).
- **Proof check:** an AI messaging finding is a duplicate only of a code finding in the same category, so real messaging
  problems are no longer hidden by an unrelated code finding.
- **The PDF reader on real decks:** letter-spaced text, fixed-width code lines, labels drawn right to left, superscripts,
  hyphenated headings in capitals, numbering such as "Order #1", and offer words inside other words. See
  [TESTING.md](TESTING.md#what-testing-found-and-what-was-fixed).

## Testing and operations

- Browser tests grew from 12 to 60, plus 12 journeys in Safari's engine, Firefox and phone sizes; a crawl of every page as
  every person; a reliability matrix; accessibility at zero violations. Unit tests grew from 89 to 173; database attacks
  refused from 22 to 32.
- Scored test set extended with PDFs, alerts (including a held-out set written by an independent labeller, a separate AI agent that
  never saw the code, before the first run), and the replay; results published with their history.
- A second Supabase project for testing, so the live database stays quiet for judging; the README's setup was proven on it
  from scratch (which found the missing grants, now migration 0015).
- Five database migrations: documents (0011), alerts and notifications (0012), rule replays (0013), indexes (0014), grants
  (0015).
- A second round of user tests (five people, four tasks), changes made from it, and a retest.
