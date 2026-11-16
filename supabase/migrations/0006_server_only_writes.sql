-- Governance hardening: check results and workflow state can only be written by the server,
-- after it has checked the visitor's access and role. Visitors can still read them (RLS).
-- Without this, a creator could call the database directly to mark a blocker "accepted",
-- push a draft into review, or rewrite a version that was already checked.
drop policy if exists runs_insert on public.check_runs;
drop policy if exists findings_insert on public.findings;
drop policy if exists findings_update on public.findings;
drop policy if exists drafts_update on public.drafts;
drop policy if exists dv_update on public.draft_versions;
drop policy if exists approvals_update on public.approvals;
