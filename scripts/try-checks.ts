import { runCodeChecks } from "../src/lib/checks";
import { seedContext } from "../src/lib/seed/context";
import { SAMPLE_DRAFTS } from "../src/lib/seed/urja";
for (const d of SAMPLE_DRAFTS) {
  const f = runCodeChecks(seedContext({ body: d.body, alt_text: d.alt_text, channel: d.channel }));
  console.log(`\n=== ${d.title} (${d.channel}) — ${f.length} findings`);
  for (const x of f) console.log(`[${x.severity}] ${x.rule_code}${x.fact_code ? "/" + x.fact_code : ""} «${x.quote}» → ${x.fix_kind}: ${x.fix_text}\n      ${x.message}`);
}
