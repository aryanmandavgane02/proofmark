// The demo brand-guide PDF and the rulebook must never disagree: every quote is on the page its rule cites.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { RULES } from "./urja";
import { locateQuote } from "@/lib/checks/proof";

describe("brand guide PDF", () => {
  it("contains every rule's quote on the cited page", async () => {
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync("public/samples/urja-brand-guide.pdf")));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = text as string[];
    expect(pages).toHaveLength(16);
    for (const r of RULES.filter((x) => !x.builtin)) {
      expect(locateQuote(pages[(r.source_page ?? 0) - 1], r.source_quote), `${r.code} on page ${r.source_page}`).not.toBeNull();
    }
  });
});
