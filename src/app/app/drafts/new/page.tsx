import Link from "next/link";
import { requireSession } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { SAMPLE_DOCUMENTS, SAMPLE_DRAFTS } from "@/lib/seed/urja";
import { NewDraftForm } from "./NewDraftForm";
import { DocumentForm } from "./DocumentForm";

// Creating a draft runs the checks; the AI half continues in the background after the response.
export const maxDuration = 60;

export default async function NewDraft(props: PageProps<"/app/drafts/new">) {
  const s = await requireSession();
  const { sample, mode } = await props.searchParams;
  const document = mode === "document";
  const tab = (active: boolean) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${active ? "bg-primary text-white shadow-sm" : "text-primary-d hover:bg-soft"}`;
  return (
    <>
      <PageTitle
        title="New draft"
        subtitle={
          document
            ? <>Upload a deck, brochure or one-pager as PDF. Proofmark checks every page against the approved {s.workspace.brand_name} rulebook, the fact ledger, the glossary and the brand typefaces, and shows each issue with its page, rule and a suggested fix.</>
            : <>Paste the content before it is published. Proofmark checks it against the approved {s.workspace.brand_name} rulebook, the fact ledger and the glossary, then shows every issue with its rule and a suggested fix.</>
        }
      />
      <nav aria-label="What to check" className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        <Link href="/app/drafts/new" aria-current={document ? undefined : "page"} className={tab(!document)}>Text or image</Link>
        <Link href="/app/drafts/new?mode=document" aria-current={document ? "page" : undefined} className={tab(document)}>Document (PDF)</Link>
      </nav>
      {document ? (
        <DocumentForm key="document" samples={SAMPLE_DOCUMENTS} initial={SAMPLE_DOCUMENTS.find((d) => d.key === sample) ?? null} clientToken={crypto.randomUUID()} />
      ) : (
        <NewDraftForm key="text" samples={SAMPLE_DRAFTS} initial={SAMPLE_DRAFTS.find((d) => d.key === sample) ?? null} clientToken={crypto.randomUUID()} />
      )}
    </>
  );
}
