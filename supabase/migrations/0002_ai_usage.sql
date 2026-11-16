-- Atomically counts one AI request against a daily cap. Returns false (and counts nothing) when the cap is reached.
create or replace function public.take_ai_request(p_scope text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  insert into ai_usage (day, scope, requests) values (current_date, p_scope, 0) on conflict do nothing;
  update ai_usage set requests = requests + 1
   where day = current_date and scope = p_scope and requests < p_limit
   returning requests into used;
  return used is not null;
end $$;
revoke all on function public.take_ai_request(text, int) from public, anon, authenticated;
