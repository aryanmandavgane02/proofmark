import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { dominantColors, type ColorShare } from "@/lib/checks/color";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function imageTypeOk(type: string) {
  return type in TYPES;
}

/** Stores an uploaded image in the private bucket. Returns its path inside the bucket. */
export async function storeImage(workspaceId: string, bytes: Buffer, type: string): Promise<string> {
  if (!imageTypeOk(type)) throw new Error("Upload a PNG, JPEG or WebP image.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("The image must be 4 MB or smaller.");
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.width) throw new Error("That file is not a readable image.");
  const path = `${workspaceId}/${randomUUID()}.${TYPES[type]}`;
  const { error } = await createAdminClient().storage.from("drafts").upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new Error(`Could not store the image: ${error.message}`);
  return path;
}

export async function loadImage(path: string): Promise<Buffer> {
  const { data, error } = await createAdminClient().storage.from("drafts").download(path);
  if (error || !data) throw new Error(`Could not read the image: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedImageUrl(path: string): Promise<string | null> {
  const { data } = await createAdminClient().storage.from("drafts").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Colour shares from a small copy of the image, and a resized copy for the AI. */
export async function analyseImage(bytes: Buffer): Promise<{ colors: ColorShare[]; forAI: { mimeType: string; data: string }; hash: string }> {
  const raw = await sharp(bytes).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const small = await sharp(bytes).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return {
    colors: dominantColors(raw, 3),
    forAI: { mimeType: "image/jpeg", data: small.toString("base64") },
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
