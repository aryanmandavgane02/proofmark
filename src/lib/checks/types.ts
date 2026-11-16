export type Category = "tone" | "terminology" | "messaging" | "visual" | "accessibility" | "claims";
export type Severity = "blocker" | "major" | "minor";
export type Channel = "instagram" | "linkedin" | "email" | "website" | "ad";
export type Field = "body" | "alt_text" | "image";
export type FixKind = "replace" | "append" | "set_alt" | "none";
export type Label = "code" | "ai_verified" | "needs_judgment";

export const CATEGORIES: Category[] = ["claims", "terminology", "tone", "messaging", "visual", "accessibility"];
export const CHANNELS: Channel[] = ["instagram", "linkedin", "email", "website", "ad"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram post",
  linkedin: "LinkedIn post",
  email: "Email",
  website: "Website copy",
  ad: "Advertisement",
};

export type Rule = {
  code: string;
  category: Category;
  title: string;
  statement: string;
  severity: Severity;
  channels: string[];
  check_kind: "code" | "ai" | "both";
  check_type: string | null;
  params: Record<string, unknown>;
  source_doc: string;
  source_page: number | null;
  source_quote: string;
  builtin: boolean;
  status: "draft" | "approved" | "rejected";
  examples?: { bad: string; good: string }[];
};

export type Fact = {
  code: string;
  statement: string;
  kind: "number" | "text";
  value: number | null;
  unit: string | null;
  keywords: string[];
  source: string;
  owner: string;
  expires_on: string | null;
  restricted: boolean;
  status: "approved" | "expired" | "superseded";
};

export type Term = { preferred: string; avoid: string[]; case_sensitive: boolean; reason: string; rule_code: string };

export type PaletteColor = { name: string; hex: string };

/** A finding before it is stored. Offsets are character positions in `field`. */
export type FindingDraft = {
  category: Category;
  severity: Severity;
  rule_code: string;
  fact_code?: string | null;
  field: Field;
  quote: string;
  start: number | null;
  end: number | null;
  message: string;
  fix_kind: FixKind;
  fix_text: string | null;
  label: Label;
};

export type CheckContext = {
  body: string;
  alt_text: string;
  channel: Channel;
  hasImage: boolean;
  rules: Rule[];
  facts: Fact[];
  terms: Term[];
  palette: PaletteColor[];
  /** ISO date (yyyy-mm-dd) used to decide whether facts have expired. */
  today: string;
};

export function ruleApplies(rule: Rule, channel: Channel): boolean {
  return rule.status === "approved" && (rule.channels.length === 0 || rule.channels.includes(channel));
}
