"use client";
import { startTransition, useActionState, useRef, useState, useSyncExternalStore } from "react";
import { prepareDocumentUpload, type FormState } from "@/app/actions";

const MAX_MB = 15;

/** What the browser can tell before uploading: empty, not a PDF, too large. The server checks the rest. */
export function checkPdfFile(f: File): string | null {
  if (!f.size) return "The file is empty.";
  if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return "Choose a PDF file. For a deck, use File → Download (or Export) → PDF in Google Slides, Canva or PowerPoint.";
  if (f.size > MAX_MB * 1048576) return `The file is ${(f.size / 1048576).toFixed(1)} MB. Upload a PDF of ${MAX_MB} MB or less.`;
  return null;
}

class UploadError extends Error {}

const noop = () => () => {};
/** False on the server and until the page is ready in the browser: the upload needs the page's script. */
export function useReady() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * Sends a PDF form in two steps: the file goes straight into private storage with a one-time link from the server
 * (Vercel functions accept request bodies of about 4.5 MB only), then the rest of the form goes to the server action,
 * which reads and checks the stored file. A second click while this runs does nothing.
 */
export function usePdfUpload(action: (state: FormState, formData: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [seen, setSeen] = useState<FormState>(undefined);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const running = useRef(false);

  async function submit(form: HTMLFormElement, file: File | null) {
    if (running.current || pending) return;
    running.current = true;
    setSeen(state); // hide the previous answer while this attempt runs
    setClientError(null);
    const fd = new FormData(form);
    fd.delete("file");
    try {
      if (file) {
        const bad = checkPdfFile(file);
        if (bad) throw new UploadError(bad);
        setUploading(true);
        const link = await prepareDocumentUpload({ size: file.size });
        if (!link.ok) throw new UploadError(link.error);
        const res = await fetch(link.url, { method: "PUT", headers: { "content-type": "application/pdf", "x-upsert": "false" }, body: file });
        if (!res.ok) throw new UploadError(res.status === 413 ? `The file is larger than ${MAX_MB} MB.` : "The upload failed. Check your connection and try again.");
        fd.set("upload_path", link.path);
        fd.set("file_name", file.name);
      }
      startTransition(() => dispatch(fd));
    } catch (e) {
      setClientError(e instanceof UploadError ? e.message : "The upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      running.current = false;
    }
  }

  const error = clientError ?? (state !== seen ? (state?.error ?? null) : null);
  return { submit, error, uploading, checking: pending, busy: uploading || pending };
}
