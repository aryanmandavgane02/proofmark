import { describe, expect, it } from "vitest";
import { parseList, readSettings, settingLabel } from "./rule-settings";

describe("rule check settings", () => {
  const current = { max_sentence_words: 25, max_avg_words: { instagram: 14, ad: 12 }, phrases: ["hurry"], required: "T&C apply" };
  const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it("keeps each setting's type and reads per-channel limits", () => {
    const r = readSettings(current, form({ "param.max_sentence_words": "20", "param.max_avg_words.instagram": "12", "param.max_avg_words.ad": "10", "param.phrases": "hurry\nlast chance, act now", "param.required": " T&C apply " }), "readability");
    expect(r).toEqual({ params: { max_sentence_words: 20, max_avg_words: { instagram: 12, ad: 10 }, phrases: ["hurry", "last chance", "act now"], required: "T&C apply" } });
  });
  it("refuses a missing or negative number, an empty list and empty required text, in plain words", () => {
    expect(readSettings({ max: 3 }, form({ "param.max": "-1" }), "hashtags")).toEqual({ error: "Most hashtags: give a number of 0 or more." });
    expect(readSettings({ min_share: 0.08 }, form({ "param.min_share": "5" }), "palette")).toEqual({ error: "Smallest area that counts, as a share of the image (0 to 1): give a number up to 1." });
    expect(readSettings({ phrases: ["hurry"] }, form({ "param.phrases": " \n " }), "pressure")).toEqual({ error: "Pressure phrases (one per line): give at least one." });
    expect(readSettings({ required: "T&C apply" }, form({}), "disclaimer")).toEqual({ error: "Text an offer must include: this cannot be empty." });
  });
  it("never adds settings the rule did not have", () => {
    const r = readSettings({ max: 2 }, form({ "param.max": "3", "param.evil": "1" }), "emoji");
    expect(r).toEqual({ params: { max: 3 } });
  });
  it("labels settings plainly", () => {
    expect(settingLabel("pressure", "max_exclamations")).toBe("Most exclamation marks");
    expect(settingLabel("unknown", "some_key")).toBe("some key");
    expect(parseList("a, b\na")).toEqual(["a", "b"]);
  });
});
