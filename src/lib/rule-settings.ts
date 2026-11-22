// Check settings of code rules (limits, required text, phrase lists), editable by the brand manager on the Rulebook
// page and applied when the rulebook is published. Pure: labels and validation are unit-tested.

const LABELS: Record<string, string> = {
  "readability.max_sentence_words": "Longest sentence, in words",
  "readability.max_avg_words": "Average sentence length per channel, in words",
  "all_caps.allow": "Words in capitals that are allowed (one per line)",
  "pressure.max_exclamations": "Most exclamation marks",
  "pressure.phrases": "Pressure phrases (one per line)",
  "hashtags.max": "Most hashtags",
  "hashtags.required": "Hashtag every post must have",
  "emoji.max": "Most emoji",
  "palette.max_delta_e": "Colour difference still counted as a brand colour (0 to 100)",
  "palette.min_share": "Smallest area that counts, as a share of the image (0 to 1)",
  "disclaimer.triggers": "Words that make it an offer (one per line)",
  "disclaimer.required": "Text an offer must include",
  "alt_text.min": "Shortest alt text, in characters",
  "alt_text.max": "Longest alt text, in characters",
};

export function settingLabel(checkType: string | null, key: string): string {
  return LABELS[`${checkType}.${key}`] ?? key.replace(/_/g, " ");
}

/** Lists are written one item per line (commas also work). */
export function parseList(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((t) => t.trim()).filter(Boolean))].slice(0, 50);
}

/**
 * New settings from the form, keeping each setting's type. Only settings the rule already has are read, so the form
 * cannot add new ones. Returns the settings, or the first problem in plain words.
 */
export function readSettings(current: Record<string, unknown>, get: (name: string) => string | null, checkType: string | null): { params: Record<string, unknown> } | { error: string } {
  const out: Record<string, unknown> = {};
  const num = (raw: string | null, label: string, max?: number): number | string => {
    const n = Number(String(raw ?? "").trim());
    if (raw == null || String(raw).trim() === "" || !Number.isFinite(n) || n < 0) return `${label}: give a number of 0 or more.`;
    if (max != null && n > max) return `${label}: give a number up to ${max}.`;
    return n;
  };
  for (const [key, value] of Object.entries(current)) {
    const label = settingLabel(checkType, key);
    if (typeof value === "number") {
      const n = num(get(`param.${key}`), label, key === "min_share" ? 1 : key === "max_delta_e" ? 100 : undefined);
      if (typeof n === "string") return { error: n };
      out[key] = n;
    } else if (typeof value === "string") {
      const t = String(get(`param.${key}`) ?? "").trim().slice(0, 80);
      if (!t) return { error: `${label}: this cannot be empty.` };
      out[key] = t;
    } else if (Array.isArray(value)) {
      const list = parseList(String(get(`param.${key}`) ?? ""));
      if (!list.length && key !== "allow") return { error: `${label}: give at least one.` };
      out[key] = list;
    } else if (value && typeof value === "object") {
      const inner: Record<string, number> = {};
      for (const sub of Object.keys(value as Record<string, unknown>)) {
        const n = num(get(`param.${key}.${sub}`), `${label} (${sub})`);
        if (typeof n === "string") return { error: n };
        inner[sub] = n;
      }
      out[key] = inner;
    } else out[key] = value;
  }
  return { params: out };
}
