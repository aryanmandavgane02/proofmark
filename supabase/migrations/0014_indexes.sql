-- Phase 6: an index for every column the app filters by, and for every foreign key.
-- Found on the live site (pg_stat_statements, Mon 23 Nov): a draft page's reads of its findings, check runs, events,
-- approvals, comments and decisions, and a workspace's terms and assets, scanned the whole table each time, with the
-- access rules checked row by row. With about 1,800 demo workspaces (most made by the test suites), that was 25 to 45 ms
-- per read on average and up to 6 s under load, and deleting one workspace took 1.6 s, one table scan per foreign key.
-- The tables are small, so plain CREATE INDEX (a moment's write lock) is fine inside the migration's transaction.

-- Reads on every draft page
create index if not exists findings_check_run_idx on public.findings (check_run_id);
create index if not exists check_runs_version_idx on public.check_runs (draft_version_id, created_at desc);
create index if not exists events_draft_idx on public.events (draft_id, created_at desc);
create index if not exists approvals_draft_idx on public.approvals (draft_id);
create index if not exists comments_draft_idx on public.comments (draft_id);
create index if not exists decisions_draft_idx on public.decisions (draft_id);

-- Reads per workspace
create index if not exists assets_workspace_idx on public.assets (workspace_id, kind);
create index if not exists terms_workspace_idx on public.terms (workspace_id);
create index if not exists findings_workspace_idx on public.findings (workspace_id);
create index if not exists check_runs_workspace_idx on public.check_runs (workspace_id);
create index if not exists approvals_workspace_idx on public.approvals (workspace_id);
create index if not exists comments_workspace_idx on public.comments (workspace_id);
create index if not exists draft_versions_workspace_idx on public.draft_versions (workspace_id);
create index if not exists imports_workspace_idx on public.imports (workspace_id);

-- The other foreign keys, so deleting a workspace, draft, finding or person does not scan the tables that point to it
create index if not exists approvals_version_idx on public.approvals (draft_version_id);
create index if not exists approvals_approver_idx on public.approvals (approver_id);
create index if not exists comments_finding_idx on public.comments (finding_id);
create index if not exists comments_person_idx on public.comments (person_id);
create index if not exists decisions_finding_idx on public.decisions (finding_id);
create index if not exists decisions_person_idx on public.decisions (person_id);
create index if not exists draft_versions_created_by_idx on public.draft_versions (created_by);
create index if not exists drafts_created_by_idx on public.drafts (created_by);
create index if not exists drafts_reviewer_idx on public.drafts (reviewer_id);
create index if not exists events_person_idx on public.events (person_id);
create index if not exists fact_alerts_created_by_idx on public.fact_alerts (created_by);
create index if not exists fact_alerts_owner_idx on public.fact_alerts (owner_id);
create index if not exists fact_alerts_resolved_by_idx on public.fact_alerts (resolved_by);
create index if not exists findings_version_idx on public.findings (draft_version_id);
create index if not exists imports_person_idx on public.imports (person_id);
create index if not exists members_active_person_idx on public.members (active_person_id);
create index if not exists notifications_person_idx on public.notifications (person_id);
create index if not exists rule_proposals_decided_by_idx on public.rule_proposals (decided_by);
create index if not exists rule_proposals_person_idx on public.rule_proposals (person_id);
create index if not exists rule_replays_created_by_idx on public.rule_replays (created_by);
create index if not exists rulebook_versions_published_by_idx on public.rulebook_versions (published_by);
create index if not exists rules_import_idx on public.rules (import_id);

analyze public.findings, public.check_runs, public.events, public.approvals, public.comments, public.decisions,
  public.assets, public.terms, public.draft_versions, public.drafts, public.imports, public.fact_alerts, public.members,
  public.notifications, public.rule_proposals, public.rule_replays, public.rulebook_versions, public.rules;
