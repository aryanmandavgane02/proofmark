import { requireSession } from "@/lib/session";
import { Card, CategoryChip, PageTitle, SeverityChip } from "@/components/ui";
import { CATEGORIES } from "@/lib/checks/types";

const KIND: Record<string, string> = { code: "Checked by code", ai: "Checked by AI", both: "Code + AI" };

export default async function Rulebook() {
  const s = await requireSession();
  const [{ data: rules }, { data: versions }] = await Promise.all([
    s.supabase.from("rules").select("*").eq("workspace_id", s.workspace.id).order("code"),
    s.supabase.from("rulebook_versions").select("version, note, published_at, published_by").eq("workspace_id", s.workspace.id).order("version", { ascending: false }),
  ]);
  const latest = versions?.[0];
  const by = new Map(s.people.map((p) => [p.id, p.name]));
  return (
    <>
      <PageTitle
        title={`Rulebook v${s.workspace.rulebook_version}`}
        subtitle={<>Every rule is small, numbered and approved by the brand manager, with the exact quote and page it came from. Simple rules run as code; judgment calls use AI. {latest && <>Published by {by.get(latest.published_by) ?? "—"}: {latest.note}.</>}</>}
      />
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const list = (rules ?? []).filter((r) => r.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold capitalize text-primary-d"><CategoryChip category={cat} /> {list.length} rule{list.length > 1 ? "s" : ""}</h2>
              <Card className="divide-y divide-line">
                {list.map((r) => (
                  <div key={r.code} className="grid gap-2 p-4 sm:grid-cols-[110px_1fr_190px]">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary-d">{r.code}</p>
                      <SeverityChip severity={r.severity} />
                    </div>
                    <div>
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-sm text-ink">{r.statement}</p>
                      <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm text-muted">&ldquo;{r.source_quote}&rdquo; <span className="text-xs">— {r.builtin ? r.source_doc : `${r.source_doc}, p. ${r.source_page}`}</span></blockquote>
                    </div>
                    <div className="text-xs text-muted">
                      <p>{KIND[r.check_kind]}</p>
                      <p>{r.channels.length ? `Channels: ${r.channels.join(", ")}` : "All channels"}</p>
                      <p className="capitalize">Status: {r.status}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })}
      </div>
    </>
  );
}
