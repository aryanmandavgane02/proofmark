-- Governance hardening, part 2: the records that insights and the audit trail are built from
-- (events, comments, decisions, approvals) can only be written by the server, which sets the
-- person from the visitor's session. Without this, a visitor could call the database directly to
-- write an event or comment in someone else's name, add fake disputes or overrides to make a rule
-- look unclear, or create an approval for a draft that is not in review.
drop policy if exists events_insert on public.events;
drop policy if exists comments_insert on public.comments;
drop policy if exists decisions_insert on public.decisions;
drop policy if exists approvals_insert on public.approvals;
