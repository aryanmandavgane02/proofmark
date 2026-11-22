// The only place the app talks to an AI model. Swap the implementation to change providers.
export type ImagePart = { mimeType: string; data: string };

export interface AIProvider {
  readonly name: string;
  /** Returns JSON matching `schema`. Throws AIUnavailableError when the model cannot be reached. */
  /** `deadline` (epoch ms) caps the whole call, retries and fallback model included. */
  generateJSON<T>(input: { system: string; prompt: string; schema: Record<string, unknown>; images?: ImagePart[]; deadline?: number }): Promise<{ data: T; model: string }>;
}

export class AIUnavailableError extends Error {
  constructor(message: string, readonly reason: "no_key" | "rate_limited" | "cap_reached" | "timeout" | "error") {
    super(message);
  }
}

/** A short, plain reason for people, never the raw error (which can contain JSON from the API). */
export function friendlyAIError(e: unknown): { message: string; reason: "rate_limited" | "timeout" | "error" } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) return { message: "The AI service is at its rate limit right now.", reason: "rate_limited" };
  if (/API key|PERMISSION_DENIED|UNAUTHENTICATED|\b40[13]\b/.test(msg)) return { message: "The AI service refused the request (the API key is missing or invalid).", reason: "error" };
  if (/took too long|timed? ?out|deadline/i.test(msg)) return { message: "The AI took too long to answer.", reason: "timeout" };
  if (/\b50[0-4]\b|UNAVAILABLE|INTERNAL|overloaded|high demand/.test(msg)) return { message: "The AI service is overloaded right now.", reason: "error" };
  if (e instanceof SyntaxError) return { message: "The AI returned an answer that could not be read.", reason: "error" };
  return { message: "The AI service is unavailable right now.", reason: "error" };
}
