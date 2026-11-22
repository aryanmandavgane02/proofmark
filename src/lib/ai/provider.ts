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
