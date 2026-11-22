-- Round 3, improvement 3: rule-change replay.
-- Before new wording for an AI-checked rule is published, every past decision on that rule is judged under the current
-- and the new wording. The replay is kept, and linked to the rulebook version it was published with.
create table if not exists public.rule_replays (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  rule_code text not null,
  old_statement text not null,
  new_statement text not null,
  rows jsonb not null default '[]',   -- each case: phrase, channel, draft, the people's verdict, the verdict under each wording, reasons
  summary jsonb not null,             -- cases, decided, changed, nowPass, nowFlag, agreeBefore, agreeAfter
  ai_model text,
  created_by uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  published_version int               -- the rulebook version this wording was published as
);
create index if not exists rule_replays_rule on public.rule_replays (workspace_id, rule_code, created_at desc);
alter table public.rule_replays enable row level security;
drop policy if exists rule_replays_read on public.rule_replays;
create policy rule_replays_read on public.rule_replays for select using (is_member(workspace_id));
-- Written by the server only, after the visitor's role was checked.
