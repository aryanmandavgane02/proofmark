-- Explicit grants for Supabase's API roles.
-- Found when setting Proofmark up from the README on a brand-new Supabase project (Mon 23 Nov 2026): newer
-- projects no longer give the anon, authenticated and service_role roles access to new tables by default,
-- so even the server's own seeding failed ("permission denied for table workspaces"). Older projects, like the
-- live one, granted this automatically. What each visitor may read or write is decided by the row-level security
-- policies in the earlier migrations, unchanged; these are the same grants the live project already has, so on
-- it this migration changes nothing.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;

-- The AI usage counter stays server-only (0002 revoked it from visitors); the server's role may call it.
grant execute on function public.take_ai_request(text, int) to service_role;
grant execute on function public.is_member(uuid) to anon, authenticated, service_role;
grant execute on function public.active_role(uuid) to anon, authenticated, service_role;
