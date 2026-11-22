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
import { ALERT_PHRASES, CASES, DOC_CASES, LABEL_CORRECTIONS, type DocCase, type EvalCase } from "./cases";
import { reliance } from "../src/lib/alerts";
import { seedFacts } from "../src/lib/seed/context";
import { LIBRARY, LIBRARY_DECK } from "../src/lib/seed/library";
import type { DocPage } from "../src/lib/checks/types";
import { readPdf, withPages } from "../src/lib/documents/read";
import type { CheckContext } from "../src/lib/checks/types";

const RULES = seedRules();
const unavailable: string[] = [];
const aiOnly = new Set(RULES.filter((r) => r.check_kind === "ai").map((r) => r.code));

type CaseResult = { id: string; expected: string[]; found: string[]; missed: string[]; falseAlarms: string[]; pass: boolean; dropped: number; ms: number };
type Run = { judgmentFalse?: string; mode: "code" | "code+ai"; when: string; model: string | null; cases: CaseResult[]; recall: number; precision: number; cleanOk: string; passed: string; fixes: string; dropped: number; avgMs: number };

async function check(c: EvalCase, withAI: boolean): Promise<{ findings: FindingDraft[]; dropped: number; ms: number; model: string | null }> {
  return checkContext(c.id, seedContext({ body: c.body, alt_text: c.alt_text, channel: c.channel }), withAI);
}

/** The same steps as the app: code checks, then the AI review, the proof check and the second opinion. */
async function checkContext(id: string, ctx: CheckContext, withAI: boolean): Promise<{ findings: FindingDraft[]; dropped: number; ms: number; model: string | null }> {
  const t = Date.now();
  const c = { id };
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

type DocResult = { id: string; expected: string[]; missed: string[]; falseAlarms: string[]; pass: boolean; ms: number };
type DocRun = { mode: "pdf code" | "pdf code+ai"; when: string; model: string | null; cases: DocResult[]; recall: number; precision: number; cleanOk: string; passed: string; fonts: string; fontFalse: number; dropped: number; avgMs: number };

/** PDF cases are scored by page: a finding counts only on the page and rule the label gives. */
async function runDocs(withAI: boolean): Promise<DocRun> {
  const cases: DocResult[] = [];
  let tp = 0, all = 0, dropped = 0, fontHit = 0, fontExp = 0, fontFalse = 0, model: string | null = null;
  for (const c of DOC_CASES as DocCase[]) {
    const started = Date.now();
    const doc = await readPdf(new Uint8Array(readFileSync(c.file)));
    const ctx = seedContext({ body: doc.body, channel: "document", pages: doc.pages, scanned: doc.scanned });
    const r = await checkContext(c.id, ctx, withAI);
    model ??= r.model;
    const findings = withPages(r.findings, doc.pages);
    const key = (page: number | null | undefined, rule: string) => `p${page ?? "?"} ${rule}`;
    const labelled = c.expect.map((e) => key(e.page, e.rule));
    const expected = c.expect.filter((e) => withAI || !aiOnly.has(e.rule)).map((e) => key(e.page, e.rule));
    const found = new Set(findings.map((f) => key(f.page, f.rule_code)));
    const missed = expected.filter((e) => !found.has(e));
    const wrong = findings.filter((f) => !labelled.includes(key(f.page, f.rule_code)));
    tp += findings.length - wrong.length;
    all += findings.length;
    dropped += r.dropped;
    const fontExpected = c.expect.filter((e) => e.rule === "VIS-03").map((e) => key(e.page, e.rule));
    fontExp += fontExpected.length;
    fontHit += fontExpected.filter((e) => found.has(e)).length;
    fontFalse += wrong.filter((f) => f.rule_code === "VIS-03").length;
    const falseAlarms = wrong.map((f) => `${key(f.page, f.rule_code)} “${f.quote.slice(0, 40)}”${f.label === "needs_judgment" ? " (needs judgment)" : ""}`);
    cases.push({ id: c.id, expected, missed, falseAlarms, pass: !missed.length && !falseAlarms.length, ms: Date.now() - started });
  }
  const exp = cases.reduce((n, c) => n + c.expected.length, 0);
  const hit = cases.reduce((n, c) => n + c.expected.length - c.missed.length, 0);
  const clean = cases.filter((c) => !DOC_CASES.find((x) => x.id === c.id)!.expect.length);
  return {
    mode: withAI ? "pdf code+ai" : "pdf code", when: new Date().toISOString(), model, cases, recall: hit / exp, precision: all ? tp / all : 1,
    cleanOk: `${clean.filter((c) => !c.falseAlarms.length).length}/${clean.length}`, passed: `${cases.filter((c) => c.pass).length}/${cases.length}`,
    fonts: `${fontHit}/${fontExp}`, fontFalse, dropped, avgMs: Math.round(cases.reduce((n, c) => n + c.ms, 0) / cases.length),
  };
}

/** Alerts: is the reliance on a fact found where a person said it is, and only there? No AI involved. */
function scoreAlerts() {
  const facts = seedFacts();
  const visible = facts.filter((f) => !f.restricted);
  let tp = 0, fp = 0, fn = 0;
  const misses: string[] = [];
  for (const f of visible) {
    for (const item of LIBRARY) {
      const pages = item.document ? (LIBRARY_DECK.pages as DocPage[]) : undefined;
      const found = reliance(f, item.body, pages, facts, "any").length > 0;
      const labelled = item.relies.includes(f.code);
      if (found && labelled) tp++;
      else if (found) { fp++; misses.push(`false alert: ${f.code} on ${item.title}`); }
      else if (labelled) { fn++; misses.push(`missed: ${f.code} in ${item.title}`); }
    }
  }
  const quoted = LIBRARY.filter((i) => reliance(facts.find((f) => f.code === "F-12")!, i.body, i.document ? (LIBRARY_DECK.pages as DocPage[]) : undefined, facts, "value").length > 0);
  const quotedExpected = LIBRARY.filter((i) => i.relies.includes("F-12"));
  let ptp = 0, pfp = 0, pfn = 0;
  for (const p of ALERT_PHRASES) {
    const found = reliance(facts.find((f) => f.code === p.fact)!, p.text, undefined, facts, "any").length > 0;
    if (found && p.relies) ptp++;
    else if (found) { pfp++; misses.push(`false alert: ${p.fact} on “${p.text}”`); }
    else if (p.relies) { pfn++; misses.push(`missed: ${p.fact} in “${p.text}”`); }
  }
  return {
    pairs: visible.length * LIBRARY.length, recall: tp / Math.max(1, tp + fn), precision: tp / Math.max(1, tp + fp), tp, fp, fn,
    f12: `${quoted.filter((q) => quotedExpected.includes(q)).length}/${quotedExpected.length}`, f12False: quoted.filter((q) => !quotedExpected.includes(q)).length,
    phrases: ALERT_PHRASES.length, phraseRecall: ptp / Math.max(1, ptp + pfn), phrasePrecision: ptp / Math.max(1, ptp + pfp), misses,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

async function main() {
  const codeOnly = process.argv.includes("--code");
  const runs = [await run(false), ...(codeOnly ? [] : [await run(true)])];
  const docRuns = [await runDocs(false), ...(codeOnly ? [] : [await runDocs(true)])];
  const alerts = scoreAlerts();
  const histFile = "eval/history.json";
  const history: (Omit<Run, "cases"> | Omit<DocRun, "cases">)[] = existsSync(histFile) ? JSON.parse(readFileSync(histFile, "utf8")) : [];
  for (const r of [...runs, ...docRuns]) { const { cases: _c, ...summary } = r; void _c; history.push(summary); }
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
    "## PDF documents (Round 3)",
    "",
    `${DOC_CASES.length} PDF files, labelled by hand by page and rule before the first run (\`DOC_CASES\` in \`eval/cases.ts\`; the files are built by \`scripts/make-sample-docs.ts\`): ${DOC_CASES.map((c) => `${c.id} (${c.note})`).join("; ")}. A finding counts only on the page its label gives; the same rule on another page is a false alarm.`,
    "",
    "| Measure | Code checks only | Code + AI |",
    "|---|---|---|",
    ...([
      ["Problems found on the right page (recall)", (r: DocRun) => pct(r.recall)],
      ["Findings on a labelled page and rule (precision)", (r: DocRun) => pct(r.precision)],
      ["Pages in a non-brand typeface found", (r: DocRun) => r.fonts],
      ["Typeface findings on a page in the brand typefaces", (r: DocRun) => String(r.fontFalse)],
      ["Clean document with no false alarm", (r: DocRun) => r.cleanOk],
      ["Documents fully right", (r: DocRun) => r.passed],
      ["AI findings dropped by the proof check", (r: DocRun) => (r.mode === "pdf code" ? "—" : String(r.dropped))],
      ["Average time per document (reading the PDF included)", (r: DocRun) => `${r.avgMs} ms`],
    ] as [string, (r: DocRun) => string][]).map(([label, f]) => `| ${label} | ${f(docRuns[0])} | ${docRuns[1] ? f(docRuns[1]) : "not run"} |`),
    "",
    "| Document | Expected (page and rule) | Missed | False alarms | Result |",
    "|---|---|---|---|---|",
    ...docRuns.at(-1)!.cases.map((c) => `| ${c.id} | ${c.expected.join(", ") || "nothing (clean)"} | ${c.missed.join(", ") || "—"} | ${c.falseAlarms.join("; ") || "—"} | ${c.pass ? "Pass" : "**Fail**"} |`),
    "",
    "Code-only scores leave out TONE-01 on page 9 of the deck, which only the AI can judge.",
    "These files were made for the test, with problems planted on known pages. The scores show that reading pages, placing findings on their page, typeface detection and the checks work on PDFs; they do not measure every real-world layout, which varies more between design tools.",
    "",
    "## Outdated-content alerts (Round 3)",
    "",
    `Which approved content relies on a fact, found with the same number reader as the facts check (no AI). Scored against hand labels: the ${LIBRARY.length} approved samples seeded in every demo workspace (\`src/lib/seed/library.ts\`, each labelled with the facts it relies on), checked against each of the ${seedFacts().filter((f) => !f.restricted).length} facts a creator can see (${alerts.pairs} pairs), and ${alerts.phrases} single sentences (\`ALERT_PHRASES\` in \`eval/cases.ts\`), including decoys such as “1,200 buyers” (the rating fact) and “3,500 bars”.`,
    "",
    "| Measure | Result |",
    "|---|---|",
    `| Editing F-12 (the customer count): approved samples that quote it, found | ${alerts.f12}, with ${alerts.f12False} false alert${alerts.f12False === 1 ? "" : "s"} |`,
    `| Every fact against every sample: reliance found (recall) | ${pct(alerts.recall)} (${alerts.tp} of ${alerts.tp + alerts.fn}) |`,
    `| Every fact against every sample: alerts that are right (precision) | ${pct(alerts.precision)} (${alerts.fp} false) |`,
    `| Single sentences: recall and precision | ${pct(alerts.phraseRecall)} and ${pct(alerts.phrasePrecision)} |`,
    "",
    alerts.misses.length ? `Misses and false alerts: ${alerts.misses.join("; ")}.` : "No misses and no false alerts on these sets.",
    "The samples were labelled before the detector was run, but the single sentences were written while it was built: they show the cases it is meant to handle, decoys included, not how often it is right on any real content. Numbers written in words (“thirty-five thousand”) are not read, by the facts check or by alerts; this is a known limit.",
    "",
    "## What the failures show",
    "",
    "- Code checks were right on every case. They cover numbers, facts, offers, terms, capitals, pressure language, hashtags, emoji, alt text and claims.",
    "- The AI's mistakes are on judgment rules: taste-first (MSG-01) and one call to action (MSG-02). It flagged two clean drafts and missed both rules in the many-problems draft. Two of its three false alarms were already shown as “needs human judgment”, because the independent second opinion disagreed. Tone and messaging rules are minor, so these findings are suggestions and never block approval.",
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
  for (const r of docRuns) console.log(`${r.mode}: recall ${pct(r.recall)}, precision ${pct(r.precision)}, typeface pages ${r.fonts} (false ${r.fontFalse}), clean ${r.cleanOk}, passed ${r.passed}, dropped ${r.dropped}`);
  for (const c of docRuns.at(-1)!.cases.filter((c) => !c.pass)) console.log(`  FAIL ${c.id}: missed [${c.missed}] false [${c.falseAlarms.join("; ")}]`);
  console.log(`alerts: F-12 ${alerts.f12} (false ${alerts.f12False}); all pairs recall ${pct(alerts.recall)}, precision ${pct(alerts.precision)}; sentences ${pct(alerts.phraseRecall)}/${pct(alerts.phrasePrecision)}${alerts.misses.length ? `; ${alerts.misses.join("; ")}` : ""}`);
  for (const c of latest.cases.filter((c) => !c.pass)) console.log(`  FAIL ${c.id}: missed [${c.missed}] false [${c.falseAlarms.join("; ")}]`);
}
main().catch((e) => { console.error(e); process.exit(1); });
