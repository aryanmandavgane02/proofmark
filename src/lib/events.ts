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
    default: return type.replace(".", " ") + ".";
  }
}
