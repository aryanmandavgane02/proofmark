// The card shown when a link to Proofmark is pasted into a chat, an email or a post.
import { ImageResponse } from "next/og";

export const alt = "Proofmark: brand guidelines as code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #f1effd 0%, #fbf7ef 55%, #eef8f5 100%)", color: "#1f2a6b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: "#2c3a8f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#5b3fd1" }}>Proofmark</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 28, letterSpacing: -1 }}>Brand guidelines as code</div>
        <div style={{ fontSize: 30, marginTop: 22, color: "#3d4a7a", lineHeight: 1.35, maxWidth: 1000 }}>
          Every draft is checked against approved rules, facts and assets, with the rule and a fix for each issue. A person makes the final call.
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 44, fontSize: 25, fontWeight: 600 }}>
          {["PDF documents and decks", "Out-of-date alerts", "Rule-change replay"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "#ffffff", border: "2px solid #c9c1f3", color: "#2c3a8f" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
