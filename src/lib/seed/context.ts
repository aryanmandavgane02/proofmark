// Converts the seed brand into check-ready objects (used by tests, the eval and the seeder).
import type { CheckContext, Channel, Fact, PaletteColor, Rule, Term } from "@/lib/checks/types";
import { BRAND_GUIDE, FACTS, PALETTE, RULES, TERMS } from "./urja";

export function seedRules(): Rule[] {
  return RULES.map((r) => ({
    code: r.code, category: r.category, title: r.title, statement: r.statement, severity: r.severity,
    channels: r.channels ?? [], check_kind: r.check_kind, check_type: r.check_type ?? null, params: r.params ?? {},
    source_doc: r.source_doc ?? BRAND_GUIDE, source_page: r.source_page ?? null, source_quote: r.source_quote,
    builtin: r.builtin ?? false, status: "approved",
  }));
}

export function seedFacts(): Fact[] {
  return FACTS.map((f) => ({
    code: f.code, statement: f.statement, kind: f.kind, value: f.value ?? null, unit: f.unit ?? null, keywords: f.keywords,
    source: f.source, owner: f.owner, expires_on: f.expires_on ?? null, restricted: f.restricted ?? false, status: f.status ?? "approved",
  }));
}

export function seedTerms(): Term[] {
  return TERMS.map((t) => ({ preferred: t.preferred, avoid: t.avoid, case_sensitive: t.case_sensitive ?? false, reason: t.reason, rule_code: "TERM-01" }));
}

export function seedPalette(): PaletteColor[] {
  return PALETTE.map((p) => ({ name: p.name, hex: p.hex }));
}

export function seedContext(input: { body: string; alt_text?: string; channel: Channel; hasImage?: boolean; today?: string }): CheckContext {
  return {
    body: input.body, alt_text: input.alt_text ?? "", channel: input.channel, hasImage: input.hasImage ?? false,
    rules: seedRules(), facts: seedFacts(), terms: seedTerms(), palette: seedPalette(), today: input.today ?? "2026-11-16",
  };
}
