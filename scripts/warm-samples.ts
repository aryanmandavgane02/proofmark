// Runs every sample draft through the real AI checks once and stores the results, so the demo's
// sample drafts answer instantly and the same way for every visitor. Usage: npm run warm
// Facts can expire (the Diwali offer ends 30 Nov 2026), which changes the prompt: TODAY=2026-12-01 npm run warm stores the answers for after that date too.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { runCodeChecks } from "../src/lib/checks";
import { proofCheck } from "../src/lib/checks/proof";
import { seedContext } from "../src/lib/seed/context";
import { SAMPLE_DRAFTS } from "../src/lib/seed/urja";
import { getProvider } from "../src/lib/ai/gemini";
import { reviewImage, reviewText, secondOpinion } from "../src/lib/ai/review";
import { readFileSync } from "node:fs";
import { analyseImage } from "../src/lib/images";
import { URJA_LOGO_PNG_BASE64 } from "../src/lib/seed/logo-png";

async function main() {
  const provider = getProvider();
  if (!provider) throw new Error("GEMINI_API_KEY is not set");
  for (const d of SAMPLE_DRAFTS) {
    const ctx = seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel, ...(process.env.TODAY ? { today: process.env.TODAY } : {}) });
    const text = await reviewText(provider, ctx, "warm-up");
    const { kept, dropped } = proofCheck(text.review.findings, ctx, runCodeChecks(ctx));
    const judgment = kept.filter((f) => f.category === "tone" || f.category === "messaging");
    if (judgment.length) await secondOpinion(provider, ctx, judgment, "warm-up");
    let img = "";
    if (d.image) {
      const a = await analyseImage(readFileSync(`public${d.image}`));
      const r = await reviewImage(provider, ctx, { ...a.forAI, hash: a.hash }, { mimeType: "image/png", data: URJA_LOGO_PNG_BASE64 }, "warm-up");
      img = ` · image: ${r.requests ? "stored" : "already stored"}, ${r.review.findings.length} visual finding(s), text read: "${r.review.text_in_image.replace(/\s+/g, " ").slice(0, 60)}"`;
    }
    console.log(`${d.key}: ${text.cached ? "already stored" : "stored"} · ${kept.length} AI finding(s) kept, ${dropped.length} dropped${img}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
