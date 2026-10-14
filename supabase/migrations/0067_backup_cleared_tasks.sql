-- A copy of every unfinished task cleared on 2026-10-14, kept outside the
-- API so any one of them can be put back.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.tasks_cleared_2026_10_14 as
  select * from public.tasks where status = false;
