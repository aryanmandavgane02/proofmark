// Plain-language descriptions of audit events, shared by the draft page and the audit trail.
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
    case "rules.imported": return `imported ${detail.drafted} draft rule(s) from ${detail.file} (${detail.dropped} not imported).`;
    case "rule.approved": return `approved rule ${detail.code}.`;
    case "rule.rejected": return `rejected or retired rule ${detail.code}.`;
    case "rule.edited": return `edited rule ${detail.code}.`;
    case "fact.added": return `added fact ${detail.code}.`;
    case "fact.edited": return `edited fact ${detail.code}.`;
    case "term.added": return `added the glossary term \u201c${detail.preferred}\u201d.`;
    case "color.added": return `added the brand colour ${detail.name} ${detail.hex}.`;
    default: return type.replace(".", " ") + ".";
  }
}
