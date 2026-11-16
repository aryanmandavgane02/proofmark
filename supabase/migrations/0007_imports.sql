-- Brand-guide imports: which file, how many rules the AI drafted, and which were dropped and why.
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  file_name text not null,
  pages int not null,
  drafted int not null default 0,
  dropped jsonb not null default '[]',
  ai_model text,
  person_id uuid references public.people,
  created_at timestamptz not null default now()
);
alter table public.imports enable row level security;
create policy imports_read on public.imports for select using (is_member(workspace_id));
-- written by the server only, after checking the visitor is the brand manager

alter table public.rules add column if not exists import_id uuid references public.imports on delete set null;
