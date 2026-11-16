-- 'reused': the AI was not asked again because only text it had already reviewed was unchanged.
alter table public.check_runs drop constraint if exists check_runs_ai_status_check;
alter table public.check_runs add constraint check_runs_ai_status_check
  check (ai_status in ('ok', 'cached', 'reused', 'unavailable', 'skipped', 'off'));
alter table public.check_runs add column if not exists reused_from_version int;
alter table public.check_runs add column if not exists reused_count int not null default 0;
