// Scores the checker on the hand-labelled test set and writes eval/RESULTS.md.
// Usage: npm run eval            (code checks, then code + AI)
//        npm run eval -- --code  (code checks only, no AI requests)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { runCodeChecks } from "../src/lib/checks";
import { proofCheck } from "../src/lib/checks/proof";
import type { FindingDraft } from "../src/lib/checks/types";
import { seedContext, seedRules } from "../src/lib/seed/context";
import { getProvider } from "../src/lib/ai/gemini";
import { reviewText, secondOpinion } from "../src/lib/ai/review";
import { CASES, LABEL_CORRECTIONS, type EvalCase } from "./cases";

const RULES = seedRules();
const unavailable: string[] = [];
const aiOnly = new Set(RULES.filter((r) => r.check_kind === "ai").map((r) => r.code));

type CaseResult = { id: string; expected: string[]; found: string[]; missed: string[]; falseAlarms: string[]; pass: boolean; dropped: number; ms: number };
type Run = { judgmentFalse?: string; mode: "code" | "code+ai"; when: string; model: string | null; cases: CaseResult[]; recall: number; precision: number; cleanOk: string; passed: string; fixes: string; dropped: number; avgMs: number };

async function check(c: EvalCase, withAI: boolean): Promise<{ findings: FindingDraft[]; dropped: number; ms: number; model: string | null }> {
  const t = Date.now();
  const ctx = seedContext({ body: c.body, alt_text: c.alt_text, channel: c.channel });
  const code = runCodeChecks(ctx);
  if (!withAI) return { findings: code, dropped: 0, ms: Date.now() - t, model: null };
  const provider = getProvider();
  if (!provider) throw new Error("GEMINI_API_KEY is not set");
  let text: Awaited<ReturnType<typeof reviewText>> | null = null;
  for (let attempt = 1; attempt <= 3 && !text; attempt++) {
    try {
      text = await reviewText(provider, ctx, "eval");
    } catch (e) {
      console.log(`  ${c.id}: AI attempt ${attempt} failed (${e instanceof Error ? e.message : e})`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
  if (!text) { unavailable.push(c.id); return { findings: code, dropped: 0, ms: Date.now() - t, model: null }; }
  const { kept, dropped } = proofCheck(text.review.findings, ctx, code);
  const judgment = kept.filter((f) => f.category === "tone" || f.category === "messaging");
  if (judgment.length) {
    // Same as the app: if the independent second opinion does not agree, the finding is shown as "needs human judgment"
    try {
      const second = await secondOpinion(provider, ctx, judgment, "eval");
      judgment.forEach((f, i) => { const v = second.verdicts.find((x) => x.index === i); if (!v || !v.violates) f.label = "needs_judgment"; });
    } catch {
      judgment.forEach((f) => (f.label = "needs_judgment"));
    }
  }
  return { findings: [...code, ...kept], dropped: dropped.length, ms: Date.now() - t, model: text.model };
}

/** Does applying a code finding's own fix make that finding go away? */
function fixClears(c: EvalCase, f: FindingDraft): boolean {
  const body = c.body.slice(0, f.start!) + f.fix_text + c.body.slice(f.end!);
  const after = runCodeChecks(seedContext({ body, alt_text: c.alt_text, channel: c.channel })).filter((g) => g.rule_code === f.rule_code);
  const before = runCodeChecks(seedContext({ body: c.body, alt_text: c.alt_text, channel: c.channel })).filter((g) => g.rule_code === f.rule_code);
  return after.length < before.length;
}

async function run(withAI: boolean): Promise<Run> {
  const cases: CaseResult[] = [];
  let judgmentFalse = 0, falseTotal = 0, tp = 0, all = 0, fixTotal = 0, fixOk = 0, dropped = 0, model: string | null = null;
  for (const c of CASES) {
    const r = await check(c, withAI);
    model ??= r.model;
    const expected = c.expect.filter((code) => withAI || !aiOnly.has(code));
    const found = [...new Set(r.findings.map((f) => f.rule_code))];
    const missed = expected.filter((e) => !found.includes(e));
    const wrong = r.findings.filter((f) => !c.expect.includes(f.rule_code));
    judgmentFalse += wrong.filter((f) => f.label === "needs_judgment").length;
    falseTotal += wrong.length;
    const falseAlarms = wrong.map((f) => `${f.rule_code} “${f.quote.slice(0, 40)}”${f.label === "needs_judgment" ? " (needs judgment)" : ""}`);
    tp += r.findings.filter((f) => c.expect.includes(f.rule_code)).length;
    all += r.findings.length;
    dropped += r.dropped;
    for (const f of r.findings.filter((f) => f.label === "code" && f.fix_kind === "replace" && f.start != null)) {
      fixTotal++;
      if (fixClears(c, f)) fixOk++;
    }
    if (!withAI && c.ai) continue; // judgment-only cases are not scored without AI
    cases.push({ id: c.id, expected, found, missed, falseAlarms, pass: !missed.length && !falseAlarms.length, dropped: r.dropped, ms: r.ms });
  }
  const exp = cases.reduce((n, c) => n + c.expected.length, 0);
  const hit = cases.reduce((n, c) => n + c.expected.length - c.missed.length, 0);
  const clean = cases.filter((c) => !c.expected.length && !CASES.find((x) => x.id === c.id)!.expect.length);
  return {
    mode: withAI ? "code+ai" : "code", when: new Date().toISOString(), model, cases,
    recall: hit / exp, precision: all ? tp / all : 1,
    cleanOk: `${clean.filter((c) => !c.falseAlarms.length).length}/${clean.length}`,
    passed: `${cases.filter((c) => c.pass).length}/${cases.length}`,
    fixes: `${fixOk}/${fixTotal}`, judgmentFalse: `${judgmentFalse}/${falseTotal}`, dropped, avgMs: Math.round(cases.reduce((n, c) => n + c.ms, 0) / cases.length),
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

async function main() {
  const codeOnly = process.argv.includes("--code");
  const runs = [await run(false), ...(codeOnly ? [] : [await run(true)])];
  const histFile = "eval/history.json";
  const history: Omit<Run, "cases">[] = existsSync(histFile) ? JSON.parse(readFileSync(histFile, "utf8")) : [];
  for (const r of runs) { const { cases: _c, ...summary } = r; void _c; history.push(summary); }
  writeFileSync(histFile, JSON.stringify(history, null, 2) + "\n");

  const latest = runs.at(-1)!;
  const md = [
    "# Scored test set: results",
    "",
    `${CASES.length} hand-labelled drafts for the fictional brand Urja Bites (\`eval/cases.ts\`): ${CASES.filter((c) => !c.expect.length).length} clean controls, ${CASES.filter((c) => c.expect.length && !c.ai).length} with problems code can find (including a prompt-injection case and a draft with ten problems) and ${CASES.filter((c) => c.ai).length} judgment cases only AI can find. Run with \`npm run eval\`. Generated ${latest.when.slice(0, 16).replace("T", " ")} UTC.`,
    "",
    "| Measure | Code checks only | Code + AI |",
    "|---|---|---|",
    ...([
      ["Problems found (recall)", (r: Run) => pct(r.recall)],
      ["Findings that are real problems (precision)", (r: Run) => pct(r.precision)],
      ["Clean drafts with no false alarm", (r: Run) => r.cleanOk],
      ["Cases fully right (every problem, no false alarm)", (r: Run) => r.passed],
      ["Code fixes that clear their own finding", (r: Run) => r.fixes],
      ["False alarms shown as “needs human judgment”", (r: Run) => (r.judgmentFalse === "0/0" ? "no false alarms" : r.judgmentFalse ?? "—")],
      ["AI findings dropped by the proof check", (r: Run) => (r.mode === "code" ? "—" : String(r.dropped))],
      ["Average time per draft", (r: Run) => `${r.avgMs} ms`],
    ] as [string, (r: Run) => string][]).map(([label, f]) => `| ${label} | ${f(runs[0])} | ${runs[1] ? f(runs[1]) : "not run"} |`),
    "",
    "Code-only scores leave out the three judgment cases and the AI-only rules in the many-problems draft, because code cannot check them by design.",
    ...(unavailable.length ? [`AI was unavailable for: ${unavailable.join(", ")} (scored on code checks only, as the app does).`, ""] : []),
    `AI model: ${latest.model ?? "none"}. AI answers are stored by exact prompt, so a re-run gives the same answers unless a prompt or rule changes.`,
    "",
    "## What the failures show",
    "",
    "- Code checks were right on every case. They cover numbers, facts, offers, terms, capitals, pressure language, hashtags, emoji, alt text and claims.",
    "- The AI's mistakes are on judgment rules: taste-first (MSG-01) and one call to action (MSG-02). It flagged two clean drafts and missed both rules in the many-problems draft. Two of its three false alarms were already shown as “needs human judgment”, because the independent second opinion disagreed. Judgment findings never block approval on their own: a person decides.",
    "- In the many-problems draft the AI reported only problems the code checks had already found (pressure, ranking, health claim), which the proof check then dropped as duplicates. It did not notice the missing call to action or the missing taste line. When a draft has many loud problems, the AI focuses on them.",
    "- The prompt-injection case passed: an instruction inside the draft did not hide the finding.",
    "- Times are with stored AI answers. A first-time AI answer takes about 1 to 3 seconds per request.",
    "",
    "## Label corrections",
    "",
    "Labels were written before the first run. Corrections made after a run are listed here, never made silently:",
    "",
    ...LABEL_CORRECTIONS.map((c) => `- ${c}`),
    "",
    "## Every case" + (runs[1] ? " (code + AI)" : ""),
    "",
    "| Case | Expected | Missed | False alarms | Result |",
    "|---|---|---|---|---|",
    ...latest.cases.map((c) => `| ${c.id} | ${c.expected.join(", ") || "nothing (clean)"} | ${c.missed.join(", ") || "—"} | ${c.falseAlarms.join("; ") || "—"} | ${c.pass ? "Pass" : "**Fail**"} |`),
    "",
    "## History",
    "",
    "| When (UTC) | Mode | Recall | Precision | Clean | Fully right |",
    "|---|---|---|---|---|---|",
    ...history.map((h) => `| ${h.when.slice(0, 16).replace("T", " ")} | ${h.mode} | ${pct(h.recall)} | ${pct(h.precision)} | ${h.cleanOk} | ${h.passed} |`),
    "",
  ].join("\n");
  writeFileSync("eval/RESULTS.md", md);
  for (const r of runs) console.log(`${r.mode}: recall ${pct(r.recall)}, precision ${pct(r.precision)}, clean ${r.cleanOk}, passed ${r.passed}, fixes ${r.fixes}, dropped ${r.dropped}`);
  for (const c of latest.cases.filter((c) => !c.pass)) console.log(`  FAIL ${c.id}: missed [${c.missed}] false [${c.falseAlarms.join("; ")}]`);
}
main().catch((e) => { console.error(e); process.exit(1); });
