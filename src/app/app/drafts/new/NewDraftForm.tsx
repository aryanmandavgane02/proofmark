"use client";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createDraft, type FormState } from "@/app/actions";
import { CHANNELS, CHANNEL_LABEL, type Channel } from "@/lib/checks/types";
import type { SeedDraft } from "@/lib/seed/urja";
import { btn, input, Card } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return <button className={btn.primary} disabled={pending}>{pending ? "Checking…" : "Check this draft"}</button>;
}

export function NewDraftForm({ samples, initial }: { samples: SeedDraft[]; initial: SeedDraft | null }) {
  const [state, action] = useActionState<FormState, FormData>(createDraft, undefined);
  const [v, setV] = useState({
    title: initial?.title ?? "", channel: (initial?.channel ?? "instagram") as Channel, body: initial?.body ?? "", alt_text: initial?.alt_text ?? "", sample_key: initial?.key ?? "",
  });
  const visual = v.channel === "instagram" || v.channel === "ad" || v.channel === "linkedin" || v.channel === "website";
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initial?.image ?? null);
  const [sampleImage, setSampleImage] = useState<boolean>(!!initial?.image);
  const [imgNote, setImgNote] = useState<string>("");

  // Large photos are shrunk in the browser (longest side 2000 px, JPEG) so uploads stay under 4 MB.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setSampleImage(false);
    setImgNote("");
    if (!f) return setPreview(null);
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setImgNote("Use a PNG, JPEG or WebP image.");
      e.target.value = "";
      return setPreview(null);
    }
    let file = f;
    if (f.size > 3.5 * 1024 * 1024) {
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
      file = new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(file);
      e.target.files = dt.files;
      setImgNote(`Resized from ${(f.size / 1048576).toFixed(1)} MB to ${(file.size / 1048576).toFixed(1)} MB.`);
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-5">
        <form action={action} className="space-y-4">
          <input type="hidden" name="sample_key" value={v.sample_key} />
          <input type="hidden" name="use_sample_image" value={sampleImage ? "1" : "0"} />
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-semibold">Title</label>
              <input id="title" name="title" required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={input} placeholder="e.g. Diwali offer post" />
            </div>
            <div>
              <label htmlFor="channel" className="mb-1 block text-sm font-semibold">Channel</label>
              <select id="channel" name="channel" value={v.channel} onChange={(e) => setV({ ...v, channel: e.target.value as Channel })} className={input}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="body" className="mb-1 block text-sm font-semibold">Content</label>
            <textarea id="body" name="body" required maxLength={5000} rows={9} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value, sample_key: "" })} className={`${input} font-mono text-[13px] leading-relaxed`} placeholder="Paste the caption, email or copy here" />
            <p className="mt-1 text-xs text-muted">{v.body.length} / 5,000 characters</p>
          </div>
          {visual && (
            <div>
              <label htmlFor="image" className="mb-1 block text-sm font-semibold">Image <span className="font-normal text-muted">(optional; PNG, JPEG or WebP)</span></label>
              <input id="image" ref={fileRef} name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:font-semibold file:text-primary-d" />
              {imgNote && (/^(This file|Use a PNG)/.test(imgNote)
                ? <p role="alert" className="mt-2 rounded-lg bg-red/10 p-2.5 text-sm font-semibold text-red">{imgNote}</p>
                : <p className="mt-1 text-xs text-muted">{imgNote}</p>)}
              {preview && (
                <div className="mt-2 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview of the image to check" className="h-32 w-32 rounded-lg border border-line object-cover" onError={() => { setPreview(null); setSampleImage(false); setImgNote("This file does not look like a valid image. Choose another one."); if (fileRef.current) fileRef.current.value = ""; }} />
                  <button type="button" className="text-xs text-muted underline" onClick={() => { setPreview(null); setSampleImage(false); if (fileRef.current) fileRef.current.value = ""; }}>Remove image</button>
                </div>
              )}
            </div>
          )}
          {visual && (
            <div>
              <label htmlFor="alt_text" className="mb-1 block text-sm font-semibold">Image alt text <span className="font-normal text-muted">(the description screen readers use)</span></label>
              <input id="alt_text" name="alt_text" maxLength={400} value={v.alt_text} onChange={(e) => setV({ ...v, alt_text: e.target.value })} className={input} placeholder="Describe the image in one sentence" />
            </div>
          )}
          {state?.error && <p role="alert" className="rounded-lg bg-red/10 p-3 text-sm text-red">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Submit />
            <span className="text-xs text-muted">Nothing is published. Checking takes a few seconds.</span>
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
              onClick={() => {
                setV({ title: s.title, channel: s.channel, body: s.body, alt_text: s.alt_text, sample_key: s.key });
                if (fileRef.current) fileRef.current.value = "";
                setPreview(s.image ?? null);
                setSampleImage(!!s.image);
              }}
              className={`w-full rounded-lg border p-3 text-left text-sm hover:bg-soft ${v.sample_key === s.key ? "border-primary bg-soft" : "border-line bg-surface"}`}
            >
              <span className="block font-semibold text-ink">{s.title}</span>
              <span className="block text-xs text-muted">{CHANNEL_LABEL[s.channel]} · {s.note}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
