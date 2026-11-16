import { requireSession } from "@/lib/session";
import { loadInsights } from "@/lib/insights-data";
import { testCasesJSON } from "@/lib/insights";

/** Human decisions as labelled test cases, for replaying against a changed rule or checker. */
export async function GET(req: Request) {
  const s = await requireSession();
  const mine = new URL(req.url).searchParams.get("view") === "mine";
  const { insights, rulebookVersion } = await loadInsights(s, !mine);
  const body = {
    workspace: s.workspace.brand_name,
    rulebook_version: rulebookVersion,
    exported_at: new Date().toISOString(),
    note: "expected 'flag' = a person accepted the fix or upheld the finding; 'pass' = a reviewer overrode it. sample = made-up demo history.",
    cases: testCasesJSON(insights.testCases),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="proofmark-test-cases${mine ? "-yours" : ""}.json"`, "cache-control": "no-store" },
  });
}
