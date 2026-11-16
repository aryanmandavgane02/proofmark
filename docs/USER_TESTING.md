# User testing (Round 2)

Five people used the live demo at https://proofmark-flame.vercel.app on their own, with no help. Each was given only the task: *"You're checking a social media post for a snack brand before it goes live. Get it approved."* Their answers are recorded below as given, followed by what changed as a result.

| Tester | Reached "Approved"? | Where they got stuck | Did they understand why findings were flagged? | One thing they'd change |
|---|---|---|---|---|
| 1. College student | Yes, about 4 min | Took some time to understand where to start the review and how to select a sample draft | Understood spelling mistakes and incorrect information, but found some brand-related explanations confusing | Add simple explanations next to technical terms and make the review process more beginner-friendly |
| 2. Small business owner | Yes, about 3 min 30 s | Was unsure whether the suggested corrections were based on the latest business information | Yes, especially when the tool explained incorrect prices or outdated information | Show the source of the correct information alongside each suggested fix |
| 3. Freelance designer | Yes, about 5 min 30 s | Was confused about the difference between a warning and an issue that could prevent approval | Mostly. Wanted more visual explanations for logo, colour and font-related issues | Add severity labels and visual comparisons to make design-related findings easier to understand |
| 4. Startup marketing executive | Yes, about 3 min | Wasn't sure whether fixing a finding automatically updated the approval status | Yes, found the explanations and references to brand rules useful | Add a progress indicator showing resolved and unresolved issues before approval |
| 5. Student club social media manager | Yes, about 5 min | Took some time to understand which findings needed immediate attention and which were only suggestions | Understood most of them, but some explanations felt too technical | Highlight the most important issues first and provide simpler explanations with suggested corrections |

**Result:** 5 of 5 reached approval unassisted, in 3 to 5½ minutes (average about 4¼).

## Changes made from this feedback

- **Summary above the findings** (testers 3, 4, 5): how many must be dealt with before review or approval, how many should be fixed, how many are suggestions.
- **Progress bar** (tester 4): "N of M dealt with".
- **Open problems listed first, most serious first** (tester 5).
- **"What do the labels mean?"** in plain words for every severity and label (testers 1, 3, 5).
- **The fact behind a fix** is shown inside the suggested fix, with its source and owner (tester 2).

## Not changed in Round 2

- **Visual comparisons** (tester 3): colour findings now show swatches of the image colour and the nearest brand colour. Font checks are part of Round 3 improvement 1 (documents and decks). Logo side-by-side comparison is not built.
- **Where to start** (tester 1): the guided checklist on Start here already covers this; further onboarding work is noted.
