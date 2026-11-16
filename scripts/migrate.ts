// Applies supabase/migrations/*.sql in name order, once each, inside a transaction per file.
// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local)
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from public._migrations`).map((r) => r.name));
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    let applied = 0;
    for (const f of files) {
      if (done.has(f)) continue;
      const body = readFileSync(path.join(dir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public._migrations (name) values (${f})`;
      });
      console.log("applied", f);
      applied++;
    }
    console.log(applied ? `${applied} migration(s) applied` : "database is up to date");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
