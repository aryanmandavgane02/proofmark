"use client";
import { useRef, useState } from "react";
import { createDocumentDraft } from "@/app/actions";
import type { SeedDocument } from "@/lib/seed/urja";
import { btn, input, Card } from "@/components/ui";
import { formatBytes } from "@/lib/bytes";
import { checkPdfFile, usePdfUpload, useReady } from "../PdfUpload";

/** New draft, "Document (PDF)": upload a deck, brochure or one-pager, or load a sample. */
export function DocumentForm({ samples, initial, clientToken }: { samples: SeedDocument[]; initial: SeedDocument | null; clientToken: string }) {
  const { submit, error, uploading, checking, busy } = usePdfUpload(createDocumentDraft);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sample, setSample] = useState<SeedDocument | null>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = useReady();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileNote(null);
    if (!f) return setFile(null);
    const bad = checkPdfFile(f);
    if (bad) {
      setFileNote(bad);
      e.target.value = "";
      return setFile(null);
    }
    setFile(f);
    setSample(null);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 120));
  }

  function pickSample(s: SeedDocument) {
    setSample(s);
    setTitle(s.title);
    setFile(null);
    setFileNote(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // Read the input itself too: a file picked before the page finished loading never reached the state.
            const chosen = sample ? null : (file ?? fileRef.current?.files?.[0] ?? null);
            if (!chosen && !sample) return setFileNote("Choose a PDF to upload, or load a sample.");
            const bad = chosen ? checkPdfFile(chosen) : null;
            if (bad) return setFileNote(bad);
            void submit(e.currentTarget, chosen);
          }}
        >
          {/* One token per form, made on the server: the same form sent twice creates one draft. */}
          <input type="hidden" name="client_token" value={clientToken} />
          <input type="hidden" name="sample_key" value={sample?.key ?? ""} />
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-semibold">Title</label>
            <input id="title" name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="e.g. Diwali retail deck" />
          </div>
          <div>
            <label htmlFor="file" className="mb-1 block text-sm font-semibold">PDF document</label>
            {sample ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-primary/30 bg-soft p-3 text-sm">
                <span aria-hidden>📄</span>
                <span><b>Sample:</b> {sample.title} ({sample.pages} page{sample.pages > 1 ? "s" : ""})</span>
                <a href={sample.file} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Open it</a>
                <button type="button" className="text-xs text-muted underline" onClick={() => setSample(null)}>Use my own PDF instead</button>
              </div>
            ) : (
              <>
                <input id="file" ref={fileRef} name="file" type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:font-semibold file:text-primary-d" />
                <p className="mt-1 text-xs text-muted">Up to 20 pages and 15 MB: a deck exported as PDF (Google Slides, Canva, PowerPoint), a brochure or a one-pager. The text must be selectable, so not a scan.</p>
                {file && <p className="mt-1 text-sm text-ink">{file.name} · {formatBytes(file.size)}</p>}
              </>
            )}
            {fileNote && <p role="alert" className="mt-2 rounded-lg bg-red/10 p-2.5 text-sm font-semibold text-red">{fileNote}</p>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red/10 p-3 text-sm text-red">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className={btn.primary} disabled={busy || !ready}>{uploading ? "Uploading…" : checking ? "Reading every page…" : "Check this document"}</button>
            <span className="text-xs text-muted">{busy ? "Every page is read and checked; this takes a few seconds." : "Every page is checked: claims, facts, terms, tone and typefaces. Nothing is published."}</span>
          </div>
        </form>
      </Card>
      <aside>
        <h2 className="mb-2 text-sm font-semibold text-primary-d">Or load a sample</h2>
        <div className="space-y-2">
          {samples.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={busy}
              onClick={() => pickSample(s)}
              className={`w-full rounded-lg border p-3 text-left text-sm hover:bg-soft ${sample?.key === s.key ? "border-primary bg-soft" : "border-line bg-surface"}`}
            >
              <span className="block font-semibold text-ink">{s.title}</span>
              <span className="block text-xs text-muted">PDF, {s.pages} page{s.pages > 1 ? "s" : ""} · {s.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Your own deck works the same way. Proofmark reads the text and the fonts of every page; pictures inside the PDF are not checked yet.</p>
      </aside>
    </div>
  );
}
