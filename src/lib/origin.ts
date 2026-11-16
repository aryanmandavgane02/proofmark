import { headers } from "next/headers";

/**
 * Where the server fetches its own sample files from. On Vercel this is the fixed production domain,
 * never the request's Host header, so a forged header cannot make the server fetch from another address.
 * Locally only localhost is accepted.
 */
export async function selfOrigin(): Promise<string> {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const host = (await headers()).get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  throw new Error("Unknown origin for sample files");
}
