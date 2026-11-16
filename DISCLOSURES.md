# Disclosures

Required by the CodeZen general rules 6 and 7 and the Submission Integrity section: reused material, templates, external services and significant AI assistance.

## Work done before the build window

None. The repository was created on 16 Nov 2026 after Round 2 opened at 10:00 IST. The only earlier material is the Round 1 plan PDF in `docs/round1/`, which is a planning document, not code.

## AI assistance

- **Claude Code (Anthropic)** is used throughout the build for planning, code, tests, seed data and documents, under the direction and review of the participant. Commits made with its help carry a `Co-Authored-By: Claude …` trailer, so its involvement is visible in the history.
- **Google Gemini API** is part of the product: it runs the AI checks (tone, messaging, claims, images) and drafts rules from an uploaded brand guide. See the in-app "AI and data use" page.

## Templates and boilerplate

- The project was started with `create-next-app` (Next.js 16), which generates the initial config files.

## External services

| Service | Used for |
|---|---|
| Vercel | Hosting |
| Supabase | Database, authentication, file storage |
| Google Gemini API (free tier) | AI checks and rule drafting |
| GitHub, GitHub Actions | Source code and automated tests |

The free Gemini tier may use submitted content to improve Google's products, so the live demo uses only fictional brand data (the "Urja Bites" brand) and says so in the app.

## Libraries

Listed in `package.json`. Main ones: Next.js, React, Tailwind CSS, @supabase/supabase-js, @supabase/ssr, @google/genai, Zod, sharp, diff, postgres, Vitest.
