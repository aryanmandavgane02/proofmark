import { requireSession } from "@/lib/session";
import { Card, PageTitle } from "@/components/ui";
import { todayIST } from "@/lib/pipeline";
import { ColorForm, FactForm, TermForm, type FactRow } from "./BrandForms";

export default async function Facts(props: PageProps<"/app/facts">) {
  const sp = await props.searchParams;
  const s = await requireSession();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 300);
  const prefill = sp.add ? { statement: one(sp.statement) ?? "", value: one(sp.value) ?? "", unit: one(sp.unit) ?? "" } : undefined;
  const [{ data: facts }, { data: terms }, { data: assets }] = await Promise.all([
    s.supabase.from("facts").select("*").eq("workspace_id", s.workspace.id).order("code"),
    s.supabase.from("terms").select("*").eq("workspace_id", s.workspace.id),
    s.supabase.from("assets").select("*").eq("workspace_id", s.workspace.id),
  ]);
  const today = todayIST();
  const manager = s.person.role === "manager";
  const nextCode = `F-${Math.max(9, ...(facts ?? []).map((f) => Number(String(f.code).replace("F-", "")) || 0)) + 1}`;
  return (
    <>
      <PageTitle
        title="Facts, terms and assets"
        subtitle={<>Claims in a draft are checked against these approved facts, and numbers are compared by code. {s.person.role === "creator" && <b>Some confidential facts are hidden from creators.</b>}</>}
      />
      <h2 className="mb-2 text-sm font-semibold text-primary-d">Fact ledger</h2>
      {manager ? (
        <details className="mb-3" open={!!prefill} id="add-fact"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a fact</summary>
          {prefill && <p className="mt-2 text-sm text-muted">Pre-filled from a claim writers keep making (Insights). Check the wording, then add a real source and owner.</p>}
          <div className="mt-2"><FactForm nextCode={nextCode} prefill={prefill} /></div></details>
      ) : (
        <p className="mb-3 text-sm text-muted">Only the brand manager (Meera) adds or edits facts.</p>
      )}
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
                  <td className="p-2.5">
                    {f.statement} {f.restricted && <span className="ml-1 rounded bg-[#ffecc7] px-1.5 text-xs text-[#7a3d00]">Confidential</span>}
                    {manager && <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-primary">Edit</summary><div className="mt-2"><FactForm fact={{ ...f, value: f.value == null ? null : Number(f.value) } as FactRow} /></div></details>}
                  </td>
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
      {manager && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a term</summary><div className="mt-2"><TermForm /></div></details>}
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
      {manager && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Add a colour</summary><div className="mt-2"><ColorForm /></div></details>}
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
