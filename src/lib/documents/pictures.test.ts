import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deckPictures } from "./pictures";
import { readPdf } from "./read";
import { pictureTextFindings } from "@/lib/checks/image-findings";
import { seedContext } from "@/lib/seed/context";

const file = (p: string) => new Uint8Array(readFileSync(p));

describe("pictures inside documents", () => {
  it("takes the photo out of the deck as a JPEG with its page, and leaves the 1-pixel icon", async () => {
    const bytes = file("e2e/fixtures/with-pictures.pdf");
    const doc = await readPdf(bytes);
    const { pictures, found } = await deckPictures(bytes, doc.pages);
    expect(found).toBe(1);
    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toMatchObject({ pages: [1], mimeType: "image/jpeg", width: 1080, height: 1080 });
    expect(Buffer.from(pictures[0].data, "base64").subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it("checks words read in a picture for claims and terms only, on the picture's page", () => {
    const ctx = seedContext({ body: "Festive gift boxes", channel: "document", today: "2026-11-23" });
    const found = pictureTextFindings("URJA bites\nINDIA'S #1\nPROTEIN BAR\n50% OFF THIS DIWALI!!!\nLimited stock. Prices may vary.", ctx, [1, 4]);
    const codes = found.map((f) => f.rule_code).sort();
    expect(codes).toContain("CLAIM-02");
    expect(codes).toContain("CLAIM-01");
    expect(codes.some((c) => c.startsWith("TONE") || c === "DISC-01" || c.startsWith("VIS"))).toBe(false);
    const ranking = found.find((f) => f.rule_code === "CLAIM-02")!;
    expect(ranking).toMatchObject({ field: "document", page: 1, pages: [1, 4], start: null, end: null, label: "needs_judgment", fix_kind: "none" });
    expect(ranking.quote).toMatch(/^In the picture on pages 1 and 4: “INDIA'S #1/);
  });
});
