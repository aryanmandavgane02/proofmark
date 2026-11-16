-- Clearer wording proposed for rules that people keep disputing or overriding (Insights).
-- Members can read them; only the server writes them, after checking the visitor is the brand manager.
create table public.rule_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  rule_code text not null,
  old_statement text not null,
  statement text not null check (length(statement) between 10 and 400),
  rationale text not null default '',
  evidence jsonb not null default '[]',
  ai_model text,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'dismissed')),
  person_id uuid references public.people,
  decided_by uuid references public.people,
  published_version int,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on public.rule_proposals (workspace_id, rule_code, created_at desc);
alter table public.rule_proposals enable row level security;
create policy proposals_read on public.rule_proposals for select using (is_member(workspace_id));
