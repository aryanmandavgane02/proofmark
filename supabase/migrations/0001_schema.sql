-- Proofmark schema. Every row belongs to a workspace (one organisation, or one demo visitor).
-- Access is enforced with row-level security: a user sees only workspaces they belong to,
-- and some actions depend on the role of the person they are currently acting as.

create extension if not exists pgcrypto;

-- ── Organisation and people ────────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text not null,
  is_demo boolean not null default false,
  code_checks_only boolean not null default false,
  rulebook_version int not null default 1,
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null,
  title text not null,
  role text not null check (role in ('creator', 'manager', 'reviewer')),
  reviewer_area text check (reviewer_area in ('legal', 'design')),
  sort int not null default 0
);
create index on public.people (workspace_id);

create table public.members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  active_person_id uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.members (user_id);

-- ── Brand rules, facts, terminology, assets ────────────────────────────────
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  code text not null,
  category text not null check (category in ('tone', 'terminology', 'messaging', 'visual', 'accessibility', 'claims')),
  title text not null,
  statement text not null,
  severity text not null check (severity in ('blocker', 'major', 'minor')),
  channels text[] not null default '{}',          -- empty = every channel
  check_kind text not null check (check_kind in ('code', 'ai', 'both')),
  check_type text,                                -- name of the code check, if any
  params jsonb not null default '{}',
  source_doc text not null,
  source_page int,
  source_quote text not null,
  examples jsonb not null default '[]',
  builtin boolean not null default false,
  status text not null default 'approved' check (status in ('draft', 'approved', 'rejected')),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table public.rulebook_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  version int not null,
  note text not null,
  published_by uuid references public.people,
  published_at timestamptz not null default now(),
  snapshot jsonb not null,
  unique (workspace_id, version)
);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  code text not null,
  statement text not null,
  kind text not null check (kind in ('number', 'text')),
  value numeric,
  unit text,                                       -- 'g', '%', 'inr', 'count', 'rating'
  keywords text[] not null default '{}',
  source text not null,
  owner text not null,
  valid_from date,
  expires_on date,
  restricted boolean not null default false,
  status text not null default 'approved' check (status in ('approved', 'expired', 'superseded')),
  unique (workspace_id, code)
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  preferred text not null,
  avoid text[] not null,
  case_sensitive boolean not null default false,
  reason text not null,
  rule_code text not null default 'TERM-01'
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind text not null check (kind in ('color', 'logo')),
  name text not null,
  hex text,
  file_path text,
  note text
);

-- ── Content and checks ─────────────────────────────────────────────────────
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  channel text not null check (channel in ('instagram', 'linkedin', 'email', 'website', 'ad')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'changes_requested', 'approved')),
  created_by uuid references public.people,
  current_version int not null default 1,
  reviewer_id uuid references public.people,
  route_reason text,
  sample_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.drafts (workspace_id, updated_at desc);

create table public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid not null references public.drafts on delete cascade,
  version int not null,
  body text not null,
  alt_text text not null default '',
  image_path text,
  intent jsonb,
  intent_confirmed boolean not null default false,
  fingerprint text not null,
  change_note text,
  created_by uuid references public.people,
  created_at timestamptz not null default now(),
  unique (draft_id, version)
);

create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_version_id uuid not null references public.draft_versions on delete cascade,
  rulebook_version int not null,
  fingerprint text not null,
  ms int not null default 0,
  ai_status text not null default 'skipped' check (ai_status in ('ok', 'cached', 'unavailable', 'skipped', 'off')),
  ai_requests int not null default 0,
  ai_model text,
  dropped jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid not null references public.drafts on delete cascade,
  draft_version_id uuid not null references public.draft_versions on delete cascade,
  check_run_id uuid not null references public.check_runs on delete cascade,
  category text not null,
  severity text not null check (severity in ('blocker', 'major', 'minor')),
  rule_code text not null,
  fact_code text,
  field text not null default 'body' check (field in ('body', 'alt_text', 'image')),
  quote text not null,
  start_at int,
  end_at int,
  message text not null,
  fix_kind text not null default 'none' check (fix_kind in ('replace', 'append', 'set_alt', 'none')),
  fix_text text,
  label text not null check (label in ('code', 'ai_verified', 'needs_judgment')),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'edited', 'disputed', 'upheld', 'overridden', 'resolved')),
  created_at timestamptz not null default now()
);
create index on public.findings (draft_id);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid not null references public.drafts on delete cascade,
  finding_id uuid references public.findings on delete set null,
  rule_code text not null,
  action text not null check (action in ('accept', 'edit', 'dispute', 'uphold', 'override')),
  reason text,
  person_id uuid references public.people,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.decisions (workspace_id, rule_code);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid not null references public.drafts on delete cascade,
  finding_id uuid references public.findings on delete set null,
  person_id uuid references public.people,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid not null references public.drafts on delete cascade,
  draft_version_id uuid not null references public.draft_versions on delete cascade,
  fingerprint text not null,
  rulebook_version int not null,
  approver_id uuid references public.people,
  overrides jsonb not null default '[]',
  ai_services jsonb not null default '[]',
  valid boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  draft_id uuid references public.drafts on delete cascade,
  person_id uuid references public.people,
  type text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.events (workspace_id, created_at desc);

-- Server-only tables (no policies, so only the service role can read or write them)
create table public.check_cache (
  key text primary key,
  result jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  day date not null,
  scope text not null,                             -- workspace id, or 'global'
  requests int not null default 0,
  primary key (day, scope)
);

-- ── Access rules ───────────────────────────────────────────────────────────
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.active_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.role from members m join people p on p.id = m.active_person_id
  where m.workspace_id = ws and m.user_id = auth.uid();
$$;

alter table public.workspaces enable row level security;
alter table public.people enable row level security;
alter table public.members enable row level security;
alter table public.rules enable row level security;
alter table public.rulebook_versions enable row level security;
alter table public.facts enable row level security;
alter table public.terms enable row level security;
alter table public.assets enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_versions enable row level security;
alter table public.check_runs enable row level security;
alter table public.findings enable row level security;
alter table public.decisions enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;
alter table public.events enable row level security;
alter table public.check_cache enable row level security;
alter table public.ai_usage enable row level security;
alter table public._migrations enable row level security;

-- Workspaces: members read; only managers change settings
create policy ws_read on public.workspaces for select using (is_member(id));
create policy ws_update on public.workspaces for update using (active_role(id) = 'manager');

create policy people_read on public.people for select using (is_member(workspace_id));

-- Members: you see and switch only your own membership, and only to a person in that workspace
create policy members_read on public.members for select using (user_id = auth.uid());
create policy members_switch on public.members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from people p where p.id = active_person_id and p.workspace_id = members.workspace_id));

-- Rules and rulebook versions: members read; only managers edit or publish
create policy rules_read on public.rules for select using (is_member(workspace_id));
create policy rules_write on public.rules for insert with check (active_role(workspace_id) = 'manager');
create policy rules_update on public.rules for update using (active_role(workspace_id) = 'manager');
create policy rbv_read on public.rulebook_versions for select using (is_member(workspace_id));
create policy rbv_write on public.rulebook_versions for insert with check (active_role(workspace_id) = 'manager');

-- Facts: restricted facts are visible only to managers and reviewers
create policy facts_read on public.facts for select using (
  is_member(workspace_id) and (not restricted or active_role(workspace_id) in ('manager', 'reviewer')));
create policy facts_write on public.facts for insert with check (active_role(workspace_id) = 'manager');
create policy facts_update on public.facts for update using (active_role(workspace_id) = 'manager');

create policy terms_read on public.terms for select using (is_member(workspace_id));
create policy terms_write on public.terms for insert with check (active_role(workspace_id) = 'manager');
create policy terms_update on public.terms for update using (active_role(workspace_id) = 'manager');

create policy assets_read on public.assets for select using (is_member(workspace_id));
create policy assets_write on public.assets for insert with check (active_role(workspace_id) = 'manager');

-- Content: any member can create and edit drafts; status changes are checked in the app and below
create policy drafts_read on public.drafts for select using (is_member(workspace_id));
create policy drafts_insert on public.drafts for insert with check (is_member(workspace_id));
create policy drafts_update on public.drafts for update using (is_member(workspace_id))
  with check (status <> 'approved' or active_role(workspace_id) in ('manager', 'reviewer'));

create policy dv_read on public.draft_versions for select using (is_member(workspace_id));
create policy dv_insert on public.draft_versions for insert with check (is_member(workspace_id));
create policy dv_update on public.draft_versions for update using (is_member(workspace_id));

create policy runs_read on public.check_runs for select using (is_member(workspace_id));
create policy runs_insert on public.check_runs for insert with check (is_member(workspace_id));

create policy findings_read on public.findings for select using (is_member(workspace_id));
create policy findings_insert on public.findings for insert with check (is_member(workspace_id));
create policy findings_update on public.findings for update using (is_member(workspace_id))
  with check (status not in ('upheld', 'overridden') or active_role(workspace_id) in ('manager', 'reviewer'));

-- Decisions: anyone can accept, edit or dispute; only managers and reviewers uphold or override
create policy decisions_read on public.decisions for select using (is_member(workspace_id));
create policy decisions_insert on public.decisions for insert with check (
  is_member(workspace_id) and (action not in ('uphold', 'override') or active_role(workspace_id) in ('manager', 'reviewer')));

create policy comments_read on public.comments for select using (is_member(workspace_id));
create policy comments_insert on public.comments for insert with check (is_member(workspace_id));

-- Approvals: only managers and reviewers approve. AI has no path to this table.
create policy approvals_read on public.approvals for select using (is_member(workspace_id));
create policy approvals_insert on public.approvals for insert with check (active_role(workspace_id) in ('manager', 'reviewer'));
create policy approvals_update on public.approvals for update using (is_member(workspace_id)) with check (valid = false);

-- Audit trail: append-only (no update or delete policy exists)
create policy events_read on public.events for select using (is_member(workspace_id));
create policy events_insert on public.events for insert with check (is_member(workspace_id));
