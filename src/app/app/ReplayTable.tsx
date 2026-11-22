// A rule-change replay: every past decision on the rule, judged under the current and the new wording, next to what
// people decided. Shown before publishing (Insights, Rulebook) and kept with the published version.
import type { StoredReplay } from "@/lib/replay-server";
import { agreement } from "@/lib/replay";

const VERDICT: Record<string, [string, string]> = {
  flag: ["Flagged", "bg-[#fde0dd] text-[#8a1c12]"],
  pass: ["Passes", "bg-[#e8f4ec] text-[#0a5c4f]"],
};
const CHANGE: Record<string, [string, string]> = {
  now_pass: ["Would now pass", "bg-[#e8f4ec] text-[#0a5c4f]"],
  now_flag: ["Would now flag", "bg-[#fde0dd] text-[#8a1c12]"],
  same: ["Unchanged", "bg-soft text-muted"],
};

function Chip({ v }: { v: [string, string] }) {
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${v[1]}`}>{v[0]}</span>;
}

export function ReplaySummary({ replay }: { replay: StoredReplay }) {
  const sm = replay.summary;
  return (
    <p className="text-sm">
      <b>{sm.changed} of {sm.cases}</b> past decision{sm.cases === 1 ? "" : "s"} would change
      {sm.changed > 0 && <> ({sm.nowPass} would now pass, {sm.nowFlag} would now be flagged)</>}.{" "}
      Agreement with the people who decided: <b>{agreement(sm.agreeBefore, sm.decided)}</b> with the current wording, <b>{agreement(sm.agreeAfter, sm.decided)}</b> with the new wording.
      {sm.cases > sm.decided && <span className="text-muted"> {sm.cases - sm.decided} finding{sm.cases - sm.decided === 1 ? " is" : "s are"} disputed but not decided yet, so {sm.cases - sm.decided === 1 ? "it does" : "they do"} not count towards agreement.</span>}
    </p>
  );
}

export function ReplayTable({ replay }: { replay: StoredReplay }) {
  return (
    <div className="space-y-2">
      <ReplaySummary replay={replay} />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Past decisions on {replay.rule_code} under the current and the new wording</caption>
          <thead className="bg-soft text-left text-xs text-muted">
            <tr>
              <th scope="col" className="p-2">Past finding</th>
              <th scope="col" className="p-2">People decided</th>
              <th scope="col" className="p-2">Current wording</th>
              <th scope="col" className="p-2">New wording</th>
              <th scope="col" className="p-2">If published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {replay.rows.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="p-2">
                  <span className="block">&ldquo;{r.quote}&rdquo;</span>
                  <span className="text-xs text-muted">{r.channel} · {r.title}{r.sample ? " · sample" : ""}</span>
                  <details className="mt-1 text-xs text-muted">
                    <summary className="cursor-pointer">Why</summary>
                    <span className="block">Current: {r.whyBefore}</span>
                    <span className="block">New: {r.whyAfter}</span>
                  </details>
                </td>
                <td className="p-2">
                  {r.human ? <Chip v={r.human === "flag" ? ["Should be flagged", VERDICT.flag[1]] : ["Should pass", VERDICT.pass[1]]} /> : <Chip v={["Not decided yet", "bg-soft text-muted"]} />}
                  {r.decidedBy && <span className="mt-0.5 block text-xs text-muted">{r.decidedBy}</span>}
                </td>
                <td className="p-2"><Chip v={VERDICT[r.before]} /></td>
                <td className="p-2"><Chip v={VERDICT[r.after]} /></td>
                <td className="p-2"><Chip v={CHANGE[r.change]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Judged by {replay.ai_model ?? "the AI"} for each wording, without seeing what people decided; answers are stored, so the same wording always replays the same way.
        {replay.published_version ? ` Published with rulebook v${replay.published_version}.` : ""}
      </p>
    </div>
  );
}
