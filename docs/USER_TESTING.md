# User testing

Two rounds of five people each. Every tester used the live demo at https://proofmark-flame.vercel.app on their own, with no help.

## Round 3 (Mon 23 Nov 2026)

Five people who had not used Proofmark did four tasks:

1. Check the sample Diwali deck (a PDF), and name one problem and its page.
2. Correct fact F-12 to 30,000+ customers, find the approved drafts that used the old number, and re-check one.
3. Get clearer wording for rule MSG-01 ("taste first"), see what it would have changed in past decisions, and decide whether to publish it.
4. Get the sample post to "Approved".

They sent their answers back as text. The answers are summarised below in their own terms. Asked afterwards for the counts they saw, all five reported 5 approved drafts affected by the F-12 change (the correct number) and 3 past decisions on MSG-01 that the new wording would change. The deck pages they named were not recorded.

| Tester | Device | Deck | Number change | Rule wording | Reached "Approved"? | Where they got stuck | One thing they'd change |
|---|---|---|---|---|---|---|---|
| 1. Student | Windows, Chrome | Done; clear | Done; clear | Done; partly clear: unsure why past decisions would change | Yes, 16 min | Thought switching person would create a new account or restart the demo; took a while to find where to review | Make switching person easier to notice, and explain what each person does |
| 2. Small business owner | Windows, Edge | Done; clear | Done; partly clear: wanted to see where the number was used in each draft | Got stuck: unsure whether to publish or leave it as a proposal | No, 18 min | The rule step: what publishing would do, and whether old approvals would be cancelled | A confirmation that explains what changes and what stays the same |
| 3. Designer | MacBook, Chrome | Done; clear | Done; clear, but wanted the old and new counts side by side | Done; clear: the comparison helped | Yes, 13 min | Some findings did not point to the exact part of the text | Highlight the exact sentence instead of a general warning |
| 4. Marketing student | Windows, Chrome | Done; partly clear: the explanation could be simpler | Done; clear | Done; partly clear: wanted examples | No, 20 min | Whether to fix everything as Arjun before switching to Meera, and when the post was actually submitted | A progress tracker showing what is done and whose turn it is |
| 5. Developer | MacBook, Chrome | Done; clear | Done; clear | Done; clear: the impact summary helped | Yes, 11 min | Whether a re-checked draft has to be submitted again | A visible history of changes to facts and rules, with the drafts affected |

**Result:** all five checked the deck and corrected the number; four of five finished the rule-wording task; three of five reached "Approved", in 11 to 16 minutes for all four tasks. The improvements were understood as follows: the deck findings by four (one partly), the outdated-content alerts by four (one partly), and the rule-change replay by two (two partly, one not).

**Limits of this testing:** five people are enough to find the main points of confusion, not to measure them. Nobody watched them, so "where they got stuck" is what they remembered, and times are their own estimates. The testers were people we know, who may be kind. The changes below have not yet been tried by new testers.

### Changes made from this feedback

- **Switching person keeps the same workspace** (testers 1 and 4). The demo banner under the header now says: "“Acting as” switches person in this same workspace; nothing restarts. Arjun writes, Ritu (legal) and Kabir (design) review, Meera manages the brand." The person menu points screen readers to it.
- **Whose turn it is** (testers 1 and 4). The draft page's "Review and approval" card now starts with three steps (Fix and submit, Review, Approved). They show which steps are done, which one is current, and who acts now, such as "Now: Ritu".
- **What publishing new wording does** (testers 1, 2 and 4). Next to the publish buttons: publishing changes the rule for every check from then on; past drafts, findings and approvals stay as they are; the replay only shows what would have been different; a proposal can be left to decide later. Publishing already took two clicks with the replay shown in between, so the confirmation step tester 2 asked for existed. What was missing was a sentence on what publishing changes.
- **What happens after a re-check** (tester 5). The messages now say what comes next. A draft sent back goes to its writer to fix, then through review again. A draft that is still correct keeps its approval, and nothing needs to be submitted again.
- **Old and new wording side by side** (testers 2 and 3). When a fact changes, its old and new wording are shown side by side: once on the Facts page above the drafts that used it, and with each alert elsewhere. Each listed draft already showed the exact words it used, with the page for decks.

### Not changed in Round 3

- **The exact sentence for every finding** (tester 3). Findings about words are already highlighted in the text, and in decks they give the page. Findings about the whole piece, such as "one clear call to action", have no single sentence to point to.
- **Simpler explanations, and examples of changed decisions** (testers 1 and 4). The replay table already lists each past decision with its verdict under the old and new wording. Plainer wording is noted for later.
- **One history per fact or rule** (tester 5). The audit trail lists every fact edit and rule publication with its time, and Insights lists every alert with the drafts it affected and what happened to them. A single history per fact that brings these together is on the roadmap.

## Round 2

Each tester was given only the task: *"You're checking a social media post for a snack brand before it goes live. Get it approved."* Their answers are recorded below as given, followed by what changed as a result.

| Tester | Reached "Approved"? | Where they got stuck | Did they understand why findings were flagged? | One thing they'd change |
|---|---|---|---|---|
| 1. College student | Yes, about 4 min | Took some time to understand where to start the review and how to select a sample draft | Understood spelling mistakes and incorrect information, but found some brand-related explanations confusing | Add simple explanations next to technical terms and make the review process more beginner-friendly |
| 2. Small business owner | Yes, about 3 min 30 s | Was unsure whether the suggested corrections were based on the latest business information | Yes, especially when the tool explained incorrect prices or outdated information | Show the source of the correct information alongside each suggested fix |
| 3. Freelance designer | Yes, about 5 min 30 s | Was confused about the difference between a warning and an issue that could prevent approval | Mostly. Wanted more visual explanations for logo, colour and font-related issues | Add severity labels and visual comparisons to make design-related findings easier to understand |
| 4. Startup marketing executive | Yes, about 3 min | Wasn't sure whether fixing a finding automatically updated the approval status | Yes, found the explanations and references to brand rules useful | Add a progress indicator showing resolved and unresolved issues before approval |
| 5. Student club social media manager | Yes, about 5 min | Took some time to understand which findings needed immediate attention and which were only suggestions | Understood most of them, but some explanations felt too technical | Highlight the most important issues first and provide simpler explanations with suggested corrections |

**Result:** 5 of 5 reached approval unassisted, in 3 to 5½ minutes (average about 4¼).

### Changes made from this feedback

- **Summary above the findings** (testers 3, 4, 5): how many must be dealt with before review or approval, how many should be fixed, how many are suggestions.
- **Progress bar** (tester 4): "N of M dealt with".
- **Open problems listed first, most serious first** (tester 5).
- **"What do the labels mean?"** in plain words for every severity and label (testers 1, 3, 5).
- **The fact behind a fix** is shown inside the suggested fix, with its source and owner (tester 2).

### Not changed in Round 2

- **Visual comparisons** (tester 3): colour findings now show swatches of the image colour and the nearest brand colour. Font checks are part of Round 3 improvement 1 (documents and decks). Logo side-by-side comparison was not built in Round 2; it was added in Round 3 (Phase 5): a logo finding shows the approved logo beside it.
- **Where to start** (tester 1): the guided checklist on Start here already covers this; further onboarding work is noted.
