// Renders the draft with each finding's text underlined. Clicking a highlight jumps to its finding.
export type Mark = { id: string; start: number; end: number; severity: string };

const STYLE: Record<string, string> = {
  blocker: "bg-[#fde0dd] decoration-red",
  major: "bg-[#ffecc7] decoration-amber",
  minor: "bg-[#e3e7f3] decoration-muted",
};
const RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2 };

export function Highlighted({ text, marks }: { text: string; marks: Mark[] }) {
  const cuts = new Set<number>([0, text.length]);
  for (const m of marks) {
    cuts.add(Math.max(0, Math.min(text.length, m.start)));
    cuts.add(Math.max(0, Math.min(text.length, m.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const covering = marks.filter((m) => m.start <= a && m.end >= b).sort((x, y) => RANK[x.severity] - RANK[y.severity]);
    const chunk = text.slice(a, b);
    if (!covering.length) parts.push(<span key={a}>{chunk}</span>);
    else
      parts.push(
        <a key={a} href={`#f-${covering[0].id}`} className={`rounded-sm underline decoration-2 underline-offset-4 ${STYLE[covering[0].severity]}`} title="Go to the finding">
          {chunk}
        </a>,
      );
  }
  return <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-ink">{parts}</p>;
}
