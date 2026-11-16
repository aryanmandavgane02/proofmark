import { requireSession } from "@/lib/session";
import { Card, PageTitle, btn } from "@/components/ui";
import { setCodeChecksOnly } from "@/app/actions";
import { GEMINI_MODELS } from "@/lib/ai/gemini";

const SERVICES = [
  { name: "Google Gemini API", use: `AI checks for tone, messaging and claims, and the second opinion. Models: ${GEMINI_MODELS.join(", ")} (fallback).`, sent: "The draft text, the AI-checked rules and the approved, non-confidential facts. Never names, emails or confidential facts." },
  { name: "Supabase (Mumbai region)", use: "Database, sign-in and file storage, with row-level security per workspace.", sent: "Everything you save in Proofmark." },
  { name: "Vercel (Mumbai region)", use: "Hosts the app.", sent: "Web requests." },
];

export default async function AIAndData() {
  const s = await requireSession();
  const manager = s.person.role === "manager";
  const on = s.workspace.code_checks_only;
  return (
    <>
      <PageTitle title="AI and data use" subtitle="What Proofmark sends where, and the controls you have. AI only suggests findings and fixes; it can never approve or publish anything." />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-primary-d">Code checks only</h2>
            <p className="text-sm text-muted">When on, no content is sent to any AI service. Terms, facts, numbers, claims, disclaimers and accessibility are still checked by code.</p>
          </div>
          <form action={setCodeChecksOnly}>
            <input type="hidden" name="on" value={on ? "false" : "true"} />
            <button className={on ? btn.accent : btn.secondary} disabled={!manager}>{on ? "On: turn AI checks back on" : "Off: switch to code checks only"}</button>
          </form>
        </div>
        {!manager && <p className="mt-2 text-xs text-muted">Only the brand manager (Meera) can change this.</p>}
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">External services</h2>
      <Card className="divide-y divide-line">
        {SERVICES.map((x) => (
          <div key={x.name} className="grid gap-1 p-4 text-sm sm:grid-cols-[200px_1fr_1fr]">
            <b>{x.name}</b>
            <span>{x.use}</span>
            <span className="text-muted">Receives: {x.sent}</span>
          </div>
        ))}
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Safeguards</h2>
      <Card className="p-5 text-sm">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Proof check:</b> an AI finding is shown only if its quote exists in the draft and the rule it cites is approved and applies to the channel. Anything else is dropped and listed under &ldquo;How this was checked&rdquo;.</li>
          <li><b>Labels:</b> every finding says whether it was verified by code, came from AI with verified evidence, or needs human judgment.</li>
          <li><b>Second opinion:</b> tone and messaging findings are checked again independently; disagreements go to a person.</li>
          <li><b>Fixes are suggestions:</b> they are re-checked by code before they are shown and are never applied without a click.</li>
          <li><b>Drafts are data:</b> text inside a draft is never treated as an instruction, and AI output cannot change statuses or approve.</li>
          <li><b>Confidential facts</b> are never sent to the AI and are hidden from creators.</li>
          <li><b>Free AI tier:</b> the provider may use submitted content to improve its services, so this demo runs only on the fictional Urja Bites brand.</li>
        </ul>
      </Card>
    </>
  );
}
