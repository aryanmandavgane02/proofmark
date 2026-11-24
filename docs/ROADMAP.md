# Roadmap

What comes after Round 3, in order. Each step says who it is for, what it takes, and how we will know it worked.

**Who Proofmark is for:** brand teams at Indian direct-to-consumer brands, and the agencies that write for them. A brand
manager owns the rules and the facts, creators (often at an agency) write the posts, ads, emails and decks, and a legal or
design reviewer signs off what carries risk. Today the demo shows this with one fictional brand and four people.

## The order, and why

The first goal is a pilot with real teams, so the steps that block a pilot come first: real accounts, data that is not
used to train an AI, and notifications that reach people outside the app. Then the things pilots are most likely to ask for.

| # | Step | For whom | What it takes | How we will know it worked |
|---|---|---|---|---|
| 1 | **Real accounts and companies:** sign-in by email or Google, a workspace per company, invitations, and the four roles (creator, brand manager, legal and design reviewer) set by the manager | Every pilot team | About 2 weeks. Supabase Auth already handles sign-in; the access rules are already per workspace, so the work is invitations, role management and moving the demo's seeding into an "example workspace" | Three pilot teams set up their own brand without help; nobody can see another company's data (the existing database attack tests, extended to invitations) |
| 2 | **AI that does not train on customer content:** move the AI calls to a paid plan or an enterprise endpoint whose terms exclude training, keep the "code checks only" switch, and state the data path on the AI and data page | Any brand sending real, unreleased content | Days of work behind the one provider interface (`src/lib/ai/`); it costs money per request. **Cost drivers:** AI requests per check (one to three for a post; one for the text of a deck plus one per picture read), and the daily caps that already exist | A pilot's legal reviewer accepts the data terms; the scored test set gives the same results on the new model before it is switched |
| 3 | **Notifications outside the app:** email (and later Slack) when a draft is assigned, sent back, approved, or out of date because a fact changed | Reviewers and creators who do not keep Proofmark open | About 1 week; the notifications already exist in the app | Median time from "submitted" to "decided" goes down in the pilot, measured from the audit trail |
| 4 | **Decks from where they are made:** import from Google Drive (Slides and PDFs), and re-check a deck when its source file changes | Agencies sending decks to brand teams | About 2 weeks; Google Drive API and OAuth | Pilots check decks through Proofmark instead of by email; decks checked per week |
| 5 | **Pictures in decks and images, fully:** logos and colours inside a deck's pictures (today only their words are read), and fonts and layout inside images | Design reviewers | About 2 to 3 weeks; renders pages or pictures on the server and compares them with the approved assets. **Cost driver:** one AI request per picture, so a limit per document stays | Design findings confirmed by the design reviewer in the pilot (the share they uphold rather than override) |
| 6 | **Hindi and Hinglish checks:** facts, claims and terms in Hindi script and in Hinglish, and a Hinglish-aware tone check | Brands writing for Indian audiences | About 2 weeks for the code checks (number words, script); the AI checks already accept the text. Needs labelled Hindi and Hinglish cases in the scored test set first | Recall and precision on a new Hindi and Hinglish section of the scored test set, published like the rest |
| 7 | **Insights by team and by creator, and a weekly digest** of repeated mistakes, unclear rules and facts about to end | Brand managers | About 1 week; every decision already records who made it | Repeated mistakes per creator go down over the pilot; rules flagged as unclear get reworded |
| 8 | **Bigger brand guides:** import of guides over 4 MB and 40 pages, the way PDFs for checking already upload straight to storage | Brands with long guides | Days; reuses the PDF upload and reading of improvement 1 | A real brand book of 100+ pages imports without being split |

## What a pilot needs that is already there

The checks with their sources, the review workflow with an audit trail, approvals tied to the exact version or file,
outdated-content alerts, rule-change replay, an accuracy score that is re-run on every change, access rules enforced by
the database, and a "code checks only" mode.

## What we will not build

- **Approval by AI, or automatic publishing.** A person always makes the final call; Proofmark suggests and explains.
- **Writing marketing copy.** Proofmark checks content and suggests fixes for the part that breaks a rule; it does not
  generate posts or campaigns.
- **A design tool or a content calendar.** Teams keep the tools they use; Proofmark checks what those tools produce.
- **Checking content the brand has not set rules for** (general grammar or style without a rule behind it): every finding
  must cite a rule the brand approved.
