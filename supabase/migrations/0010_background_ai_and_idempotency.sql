-- Round 3 · Phase 1: AI checks run in the background, and repeated actions are safe.
-- A check run is 'running' between the code findings being saved and the AI findings arriving.
alter table public.check_runs drop constraint if exists check_runs_ai_status_check;
alter table public.check_runs add constraint check_runs_ai_status_check
  check (ai_status in ('ok', 'cached', 'reused', 'unavailable', 'skipped', 'off', 'running'));

-- Each New draft form carries a one-time token, so a double click or a resubmitted form creates one draft, not two.
alter table public.drafts add column if not exists client_token text;
create unique index if not exists drafts_workspace_client_token_key
  on public.drafts (workspace_id, client_token) where client_token is not null;
