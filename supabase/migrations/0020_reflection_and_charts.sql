-- Phase 5 — the Day Card.
--
-- Two additions the redesigned reflection flow needs, plus the read path
-- behind "ask Claude to chart my data".

-- 1. The three centering questions. `thoughts` was already the free journal
--    prompt and gratitude/gods_hand already existed; these are the guided
--    questions that come before them. `reflection_completed_at` is what
--    gates the "plan tomorrow" step — the plan is the last thing you do,
--    not something you can jump to.
alter table public.journal_entries
  add column if not exists q_christ text,
  add column if not exists q_principles text,
  add column if not exists q_success text,
  add column if not exists reflection_completed_at timestamptz;

-- 2. Notes you leave for tomorrow before the AI drafts a plan. They live on
--    tomorrow's day_plan row, so they're attached to the day they describe
--    and survive re-generating the plan more than once.
alter table public.day_plans
  add column if not exists notes text;

-- 3. The chart read path.
--
--    "Map out my sleep over the past 6 months" can't be answered by a fixed
--    set of pre-built rollups — the shape of the question is open. So the
--    assistant writes the query and this runs it.
--
--    SECURITY INVOKER (the default, stated here because it's the whole
--    point) means the statement executes as the signed-in user with RLS
--    fully in force: it can only ever see rows that user already owns. The
--    guards below are the second line — one statement, read-only, capped —
--    so a malformed or manipulated query fails loudly instead of writing.
create or replace function public.run_readonly_select(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sql text := btrim(btrim(p_sql), ';');
  v_result jsonb;
begin
  if position(';' in v_sql) > 0 then
    raise exception 'Only one statement is allowed.';
  end if;

  if v_sql !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT is allowed.';
  end if;

  if v_sql ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|vacuum|refresh|listen|notify|set|reset|lock|prepare|execute)\M' then
    raise exception 'Only a read-only SELECT is allowed.';
  end if;

  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t',
    'select * from (' || v_sql || ') q limit 2000'
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.run_readonly_select(text) from public;
grant execute on function public.run_readonly_select(text) to authenticated;
