// Plain-language descriptions of audit events, shared by the draft page and the audit trail.
import { plural } from "./plural";
export function describeEvent(type: string, detail: Record<string, unknown>): string {
  switch (type) {
    case "draft.created": return "created the draft and ran the checks.";
    case "version.created": return `saved version ${detail.version}: ${detail.note}.`;
    case "finding.disputed": return `disputed ${detail.rule}.`;
    case "finding.overridden": return `overrode ${detail.rule}.`;
    case "finding.upheld": return `upheld ${detail.rule}.`;
    case "draft.submitted": return `submitted it for review. Routed to ${detail.reviewer}: ${detail.reason}`;
    case "draft.approved": return `approved version ${detail.version}.`;
    case "draft.changes_requested": return "requested changes.";
    case "approval.invalidated": return "edited it after approval, so it needs a new approval.";
    case "comment.added": return detail.on_finding ? "commented on a finding." : "commented.";
    case "checks.rerun": return `ran the checks again on version ${detail.version}.`;
    case "intent.confirmed": return "confirmed what the draft is for.";
    case "workspace.created": return "created this workspace.";
    case "settings.code_checks_only": return detail.on ? "switched the workspace to code checks only." : "turned AI checks back on.";
    case "rulebook.published": return `published rulebook v${detail.version}: ${detail.note}.`;
    case "rules.imported": return `imported ${plural(Number(detail.drafted), "draft rule")} from ${detail.file} (${detail.dropped} not imported).`;
    case "rule.approved": return `approved rule ${detail.code}.`;
    case "rule.rejected": return `rejected draft rule ${detail.code}.`;
    case "rule.retired": return `retired rule ${detail.code}; it leaves the rulebook when the next version is published.`;
    case "rule.edited": return `edited rule ${detail.code}.`;
    case "rule.clarity_proposed": return `asked the AI for clearer wording of ${detail.code} (${detail.disputed} disputed, ${detail.overridden} overridden).`;
    case "rule.clarified": return `reworded ${detail.code} and published rulebook v${detail.version}.`;
    case "rule.wording_kept": return `kept the wording of ${detail.code} after reviewing the pushback.`;
    case "fact.added": return `added fact ${detail.code}.`;
    case "fact.edited": return factEdit(detail);
    case "term.added": return `added the glossary term \u201c${detail.preferred}\u201d.`;
    case "color.added": return `added the brand colour ${detail.name} ${detail.hex}.`;
    case "typeface.added": return `added the brand typeface ${detail.name}.`;
    case "sample.approved": return "approved this sample content (before this demo began).";
    case "alerts.raised": return `raised ${detail.count} out-of-date alert${detail.count === 1 ? "" : "s"} for fact ${detail.fact}${detail.kind === "expired" ? " (it ended)" : detail.kind === "expiring" ? " (it ends soon)" : " (it changed)"}.`;
    case "alert.sent_back": return `sent it back after a re-check: fact ${detail.fact} changed (${detail.quote ? `“${detail.quote}”` : "see the findings"}).`;
    case "alert.still_correct": return `re-checked it after fact ${detail.fact} changed: still correct.`;
    case "typeface.removed": return `removed the brand typeface ${detail.name}.`;
    default: return type.replace(".", " ") + ".";
  }
}

type FactSnapshot = { statement?: string; expires_on?: string | null };
const longDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A fact edit with its old and new wording, when the event recorded them (edits since Round 3's user tests). */
function factEdit(detail: Record<string, unknown>): string {
  const from = detail.from as FactSnapshot | undefined;
  const to = detail.to as FactSnapshot | undefined;
  if (from?.statement && to?.statement && from.statement !== to.statement) return `changed fact ${detail.code} from “${from.statement}” to “${to.statement}”.`;
  if (from && to && (from.expires_on ?? null) !== (to.expires_on ?? null)) return to.expires_on ? `set fact ${detail.code} to end after ${longDay(to.expires_on)}.` : `removed the end date of fact ${detail.code}.`;
  return `edited fact ${detail.code}.`;
}
