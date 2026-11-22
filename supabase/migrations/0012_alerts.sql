-- Round 3, improvement 2: outdated-content alerts.
-- When a fact changes or expires, every approved draft that relied on it gets an alert with the evidence, and the
-- draft's owner gets an in-app notification. Alerts and notifications are written by the server only.

-- Sample approved content seeded into each demo workspace (labelled in the app, ignored by the guided checklist).
alter table public.drafts add column if not exists is_sample boolean not null default false;

-- The expiry date whose alerts have been raised, so a passed expiry raises its alerts once.
alter table public.facts add column if not exists expiry_alerted_on date;

create table if not exists public.fact_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  fact_code text not null,
  kind text not null check (kind in ('changed', 'expiring', 'expired')),
  -- What raised it, e.g. 'changed:<event id>', 'expiring:2026-11-30', 'expired:2026-10-20'. One alert per version, fact and trigger.
  trigger text not null,
  draft_id uuid not null references public.drafts on delete cascade,
  draft_version_id uuid not null references public.draft_versions on delete cascade,
  owner_id uuid references public.people on delete set null,
  before jsonb,                          -- the fact as the draft relied on it
  after jsonb,                           -- the fact now
  evidence jsonb not null default '[]',  -- [{quote, start, end, page, how}]
  due_on date,                           -- expiring alerts: the fact's last valid day
  status text not null default 'open' check (status in ('open', 'still_correct', 'sent_back', 'superseded')),
  outcome text,                          -- what the re-check found, in one sentence
  resolved_by uuid references public.people on delete set null,
  resolved_at timestamptz,
  created_by uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  unique (draft_version_id, fact_code, trigger)
);
create index if not exists fact_alerts_workspace_status on public.fact_alerts (workspace_id, status);
create index if not exists fact_alerts_draft on public.fact_alerts (draft_id);
alter table public.fact_alerts enable row level security;
drop policy if exists fact_alerts_read on public.fact_alerts;
create policy fact_alerts_read on public.fact_alerts for select using (is_member(workspace_id));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  text text not null check (length(text) between 1 and 500),
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_person on public.notifications (workspace_id, person_id, read_at);
alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (is_member(workspace_id));
