"use client";
import { useRef, useState } from "react";
import { uploadCorrectedDocument } from "@/app/actions";
import { btn } from "@/components/ui";
import { formatBytes } from "@/lib/bytes";
import { checkPdfFile, usePdfUpload, useReady } from "../PdfUpload";

/** A PDF cannot be edited here: the creator fixes the source file and uploads it again as the next version. */
export function CorrectedPdfForm({ draftId, sampleCorrected }: { draftId: string; sampleCorrected?: string }) {
  const { submit, error, uploading, checking, busy } = usePdfUpload(uploadCorrectedDocument);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const ready = useReady();
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        // Read the input itself too: a file picked before the page finished loading never reached the state.
        const chosen = file ?? ref.current?.files?.[0] ?? null;
        if (!chosen) return setNote("Choose the corrected PDF first.");
        const bad = checkPdfFile(chosen);
        if (bad) return setNote(bad);
        void submit(e.currentTarget, chosen);
      }}
    >
      <input type="hidden" name="draft_id" value={draftId} />
      <p className="text-sm text-muted">Fix the findings in the source file (Google Slides, Canva, PowerPoint or Word), export it as PDF again and upload it here. It becomes the next version and every page is checked again.</p>
      {sampleCorrected && (
        <p className="rounded-lg bg-soft p-2.5 text-sm">
          Trying the demo? <a href={sampleCorrected} download className="font-semibold text-primary underline">Download the corrected sample deck</a>, then choose it below.
        </p>
      )}
      <div>
        <label htmlFor="corrected" className="mb-1 block text-sm font-semibold">Corrected PDF</label>
        <input
          id="corrected" ref={ref} name="file" type="file" accept="application/pdf,.pdf" disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            const bad = f ? checkPdfFile(f) : null;
            setNote(bad);
            if (bad) e.target.value = "";
            setFile(bad ? null : f);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:font-semibold file:text-primary-d"
        />
        {file && <p className="mt-1 text-sm">{file.name} · {formatBytes(file.size)}</p>}
      </div>
      {(note || error) && <p role="alert" className="rounded-lg bg-red/10 p-2.5 text-sm font-semibold text-red">{note ?? error}</p>}
      <button className={btn.secondary} disabled={busy || !ready}>{uploading ? "Uploading…" : checking ? "Checking every page…" : "Upload and check again"}</button>
    </form>
  );
}
