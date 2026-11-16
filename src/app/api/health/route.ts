// Deployment check: reports which settings are present (never their values).
export const dynamic = "force-dynamic";

export function GET() {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
  const env = Object.fromEntries(keys.map((k) => [k, Boolean(process.env[k])]));
  return Response.json({ ok: Object.values(env).every(Boolean), env });
}
