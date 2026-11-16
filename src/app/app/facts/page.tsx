import { requireSession } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { todayIST } from "@/lib/pipeline";

export default async function Facts() {
  const s = await requireSession();
  const [{ data: facts }, { data: terms }, { data: assets }] = await Promise.all([
    s.supabase.from("facts").select("*").eq("workspace_id", s.workspace.id).order("code"),
    s.supabase.from("terms").select("*").eq("workspace_id", s.workspace.id),
    s.supabase.from("assets").select("*").eq("workspace_id", s.workspace.id),
  ]);
  const today = todayIST();
  return (
    <>
      <PageTitle
        title="Facts, terms and assets"
        subtitle={<>Claims in a draft are checked against these approved facts, and numbers are compared by code. {s.person.role === "creator" && <b>Some confidential facts are hidden from creators.</b>}</>}
      />
      <h2 className="mb-2 text-sm font-semibold text-primary-d">Fact ledger</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-d text-left text-white">
            <tr><th className="p-2.5">Code</th><th className="p-2.5">Approved fact</th><th className="p-2.5">Source</th><th className="p-2.5">Owner</th><th className="p-2.5">Valid until</th><th className="p-2.5">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(facts ?? []).map((f) => {
              const expired = f.status === "expired" || (f.expires_on && f.expires_on < today);
              return (
                <tr key={f.code} className={expired ? "text-muted" : ""}>
                  <td className="p-2.5 font-mono font-bold">{f.code}</td>
                  <td className="p-2.5">{f.statement} {f.restricted && <span className="ml-1 rounded bg-[#ffecc7] px-1.5 text-xs text-[#7a3d00]">Confidential</span>}</td>
                  <td className="p-2.5">{f.source}</td>
                  <td className="p-2.5">{f.owner}</td>
                  <td className="p-2.5">{f.expires_on ?? "—"}</td>
                  <td className="p-2.5">{expired ? "Expired" : "Current"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Glossary (rule TERM-01)</h2>
      <Card className="divide-y divide-line">
        {(terms ?? []).map((t) => (
          <div key={t.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[180px_1fr_1fr]">
            <span className="font-semibold text-[#0a5c4f]">Use: {t.preferred}</span>
            <span className="text-red">Avoid: {t.avoid.join(", ")}</span>
            <span className="text-muted">{t.reason}</span>
          </div>
        ))}
      </Card>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-primary-d">Brand palette (rule VIS-02)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(assets ?? []).filter((a) => a.kind === "color").map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <div className="h-16" style={{ background: a.hex }} />
            <div className="p-2.5 text-sm"><b>{a.name}</b> <span className="font-mono text-muted">{a.hex}</span></div>
          </Card>
        ))}
      </div>
    </>
  );
}
