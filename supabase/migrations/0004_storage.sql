-- Private bucket for draft images. No storage policies: only the server (service role) reads or writes,
-- after the visitor's access to the draft has been checked through row-level security.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drafts', 'drafts', false, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
