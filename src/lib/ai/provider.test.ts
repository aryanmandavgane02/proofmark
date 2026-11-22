import { describe, expect, it } from "vitest";
import { AIUnavailableError, friendlyAIError } from "./provider";

// People see these messages on the draft page, so they must never contain the raw API error.
describe("friendlyAIError", () => {
  const raw = (status: number, text: string, code: string) =>
    new Error(JSON.stringify({ error: { code: status, message: text, status: code, details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo" }] } }));

  it("names an invalid key without showing the API's JSON", () => {
    const r = friendlyAIError(raw(400, "API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT"));
    expect(r.message).toBe("The AI service refused the request (the API key is missing or invalid).");
    expect(r.message).not.toMatch(/[{}"]/);
  });
  it("recognises the rate limit", () => {
    expect(friendlyAIError(raw(429, "Resource has been exhausted (e.g. check quota).", "RESOURCE_EXHAUSTED"))).toEqual({ message: "The AI service is at its rate limit right now.", reason: "rate_limited" });
  });
  it("recognises an overloaded model", () => {
    expect(friendlyAIError(raw(503, "The model is overloaded. Please try again later.", "UNAVAILABLE")).message).toBe("The AI service is overloaded right now.");
    expect(friendlyAIError(raw(500, "An internal error has occurred.", "INTERNAL")).message).toBe("The AI service is overloaded right now.");
  });
  it("recognises a timeout", () => {
    expect(friendlyAIError(new AIUnavailableError("The AI took too long to answer.", "timeout"))).toEqual({ message: "The AI took too long to answer.", reason: "timeout" });
  });
  it("explains an unreadable answer", () => {
    let parseError: unknown;
    try { JSON.parse("{not json"); } catch (e) { parseError = e; }
    expect(friendlyAIError(parseError).message).toBe("The AI returned an answer that could not be read.");
  });
  it("falls back to a plain sentence for anything else", () => {
    expect(friendlyAIError(new Error("fetch failed: ECONNRESET {\"x\":1}")).message).toBe("The AI service is unavailable right now.");
    expect(friendlyAIError("weird").message).toBe("The AI service is unavailable right now.");
  });
});
