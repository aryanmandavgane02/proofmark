-- Round 3, improvement 1: PDF documents and slide decks as a content format.
-- A document version keeps the exact file (private bucket "documents"), its SHA-256, its page count and, for each page,
-- where the page's text sits in the version's body and which fonts set it. Every finding on a document has its page.

alter table public.drafts drop constraint if exists drafts_channel_check;
alter table public.drafts add constraint drafts_channel_check
  check (channel in ('instagram', 'linkedin', 'email', 'website', 'ad', 'document'));

alter table public.draft_versions
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_hash text,
  add column if not exists file_size int,
  add column if not exists page_count int,
  add column if not exists pages jsonb,
  add column if not exists scanned boolean not null default false;

-- "document" findings are about the file itself (for example a typeface), not about the wording.
alter table public.findings add column if not exists page int;
alter table public.findings drop constraint if exists findings_field_check;
alter table public.findings add constraint findings_field_check check (field in ('body', 'alt_text', 'image', 'document'));

-- The approval names the exact file that was approved.
alter table public.approvals add column if not exists file_hash text;

-- Brand typefaces sit next to the brand colours.
alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check check (kind in ('color', 'logo', 'font'));

-- Private bucket for documents. As with images there are no storage policies: only the server reads files, and the
-- browser uploads with a one-time signed link the server makes for a path inside the visitor's workspace.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;
