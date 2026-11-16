// Runs every sample draft through the real AI checks once and stores the results, so the demo's
// sample drafts answer instantly and the same way for every visitor. Usage: npm run warm
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { runCodeChecks } from "../src/lib/checks";
import { proofCheck } from "../src/lib/checks/proof";
import { seedContext } from "../src/lib/seed/context";
import { SAMPLE_DRAFTS } from "../src/lib/seed/urja";
import { getProvider } from "../src/lib/ai/gemini";
import { reviewText, secondOpinion } from "../src/lib/ai/review";

async function main() {
  const provider = getProvider();
  if (!provider) throw new Error("GEMINI_API_KEY is not set");
  for (const d of SAMPLE_DRAFTS) {
    const ctx = seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel });
    const text = await reviewText(provider, ctx, "warm-up");
    const { kept, dropped } = proofCheck(text.review.findings, ctx, runCodeChecks(ctx));
    const judgment = kept.filter((f) => f.category === "tone" || f.category === "messaging");
    if (judgment.length) await secondOpinion(provider, ctx, judgment, "warm-up");
    console.log(`${d.key}: ${text.cached ? "already stored" : "stored"} · ${kept.length} AI finding(s) kept, ${dropped.length} dropped`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
