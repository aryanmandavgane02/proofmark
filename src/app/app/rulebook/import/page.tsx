import { requireSession } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export default async function ImportRules() {
  const s = await requireSession();
  return (
    <>
      <PageTitle
        title="Import rules from a brand guide"
        subtitle="Upload a PDF. The AI drafts small, checkable rules, each with the exact quote and page it came from. Code then confirms every quote is really in the document and drops duplicates. Nothing is enforced until you approve the rules and publish a new rulebook version."
      />
      {s.person.role !== "manager" ? (
        <p className="rounded-lg bg-soft p-4 text-sm">Only the brand manager can import rules. Switch to <b>Meera</b> with &ldquo;Acting as&rdquo; at the top.</p>
      ) : (
        <ImportForm />
      )}
    </>
  );
}
