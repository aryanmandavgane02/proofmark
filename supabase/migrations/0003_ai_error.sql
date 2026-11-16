-- Why the AI step did not run (shown to the user), and how long it took.
alter table public.check_runs add column if not exists ai_error text;
alter table public.check_runs add column if not exists ai_ms int;
