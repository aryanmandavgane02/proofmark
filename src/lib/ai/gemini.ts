import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AIUnavailableError, type AIProvider, type ImagePart } from "./provider";

// Fastest model first; the second is a fallback when the first is rate-limited or down.
export const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new AIUnavailableError("The AI model took too long to answer.", "timeout")), ms))]);
}

export class GeminiProvider implements AIProvider {
  readonly name = "Google Gemini";
  private ai: GoogleGenAI;
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJSON<T>(input: { system: string; prompt: string; schema: Record<string, unknown>; images?: ImagePart[]; deadline?: number }) {
    let lastError: unknown;
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        // Never start a request that cannot finish before the caller's deadline.
        const left = input.deadline ? input.deadline - Date.now() : TIMEOUT_MS;
        if (left < 2_500) throw new AIUnavailableError("The AI took too long to answer, so only code checks are shown. Run the checks again to retry.", "timeout");
        try {
          const parts = [
            ...(input.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
            { text: input.prompt },
          ];
          const res = await withTimeout(
            this.ai.models.generateContent({
              model,
              contents: [{ role: "user", parts }],
              config: { systemInstruction: input.system, responseMimeType: "application/json", responseJsonSchema: input.schema, temperature: 0, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
            }),
            Math.min(TIMEOUT_MS, left),
          );
          const text = res.text ?? "";
          return { data: JSON.parse(text) as T, model };
        } catch (e) {
          lastError = e;
          const msg = e instanceof Error ? e.message : String(e);
          const retryable = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|overloaded/i.test(msg);
          if (e instanceof SyntaxError) break; // bad JSON: try the next model
          if (!retryable) break;
          if (attempt === 0 && (!input.deadline || input.deadline - Date.now() > 4_000)) await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new AIUnavailableError(`The AI model is unavailable right now (${msg.slice(0, 120)}).`, /429|RESOURCE_EXHAUSTED/.test(msg) ? "rate_limited" : "error");
  }
}

export function getProvider(): AIProvider | null {
  const key = process.env.GEMINI_API_KEY;
  return key ? new GeminiProvider(key) : null;
}
