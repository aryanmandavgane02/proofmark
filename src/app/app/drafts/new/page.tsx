import { requireSession } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { SAMPLE_DRAFTS } from "@/lib/seed/urja";
import { NewDraftForm } from "./NewDraftForm";

// Creating a draft runs the checks; the AI half continues in the background after the response.
export const maxDuration = 60;

export default async function NewDraft(props: PageProps<"/app/drafts/new">) {
  const s = await requireSession();
  const { sample } = await props.searchParams;
  const initial = SAMPLE_DRAFTS.find((d) => d.key === sample) ?? null;
  return (
    <>
      <PageTitle
        title="New draft"
        subtitle={<>Paste the content before it is published. Proofmark checks it against the approved {s.workspace.brand_name} rulebook, the fact ledger and the glossary, then shows every issue with its rule and a suggested fix.</>}
      />
      <NewDraftForm samples={SAMPLE_DRAFTS} initial={initial} />
    </>
  );
}
