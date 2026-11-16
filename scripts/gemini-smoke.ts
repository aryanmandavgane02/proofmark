// Phase 0 smoke test: which Gemini models this key can use, and whether JSON-schema output works.
import "dotenv/config";
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
config({ path: ".env.local" });

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const names: string[] = [];
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if (m.supportedActions?.includes("generateContent") && /gemini/.test(m.name ?? "")) names.push(m.name!.replace("models/", ""));
  }
  console.log("generateContent models:", names.join(", "));

  const candidates = names.filter((n) => /flash/.test(n) && !/image|tts|audio|live|preview-0|exp/.test(n));
  for (const model of candidates.slice(0, 6)) {
    const t0 = Date.now();
    try {
      const r = await ai.models.generateContent({
        model,
        contents: 'Caption: "India\'s #1 protein bar!!! Hurry". Return the over-hyped phrase.',
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object", properties: { phrase: { type: "string" } }, required: ["phrase"] },
        },
      });
      console.log(`OK   ${model} ${Date.now() - t0}ms ->`, r.text?.slice(0, 80));
    } catch (e: unknown) {
      console.log(`FAIL ${model} ->`, String(e instanceof Error ? e.message : e).slice(0, 160));
    }
  }
}
main();
