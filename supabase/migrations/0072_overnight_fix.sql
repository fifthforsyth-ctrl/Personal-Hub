-- Honest tracking: the fix list for old timers that ran through the night.
--
-- Before the runaway card, a timer left going at bedtime ran on until
-- morning ("Prep for bed" from 9:46 pm to 5:52 am). Today lists those once;
-- each can be fixed in a tap or left as it is. Nothing changes until you
-- tap, and a fix keeps the end the timer had, so it can always be put back.
--
--   time_log_entries
--     original_ended_at  the end a timer had before an overnight fix moved
--                        it; null on everything else
--   fix_overnight_timer(id, end, sleep_from, sleep_until)
--     ends the timer at `end` (its old end saved in original_ended_at,
--     ended_by 'overnight_fix') and, when you were asleep, adds the Sleep
--     entry from sleep_from to sleep_until (split_from = the timer). One
--     transaction, so a fix is never half done. Runs as you (security
--     invoker), so row-level security keeps it to your own entries.
--
-- Leaving one as it is needs no function: the app sets ended_by = 'stop',
-- which is what it always was (a timer stopped by hand at that time).
--
-- To put a fix back (SQL Editor):
--   delete from public.time_log_entries s
--    using public.time_log_entries t
--    where s.split_from = t.id and s.ended_by = 'overnight_fix' and t.original_ended_at is not null;
--   update public.time_log_entries
--      set ended_at = original_ended_at, original_ended_at = null, ended_by = null
--    where original_ended_at is not null;
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop function if exists public.fix_overnight_timer(uuid, timestamptz, timestamptz, timestamptz);
--   alter table public.time_log_entries drop column if exists original_ended_at;

alter table public.time_log_entries
  add column if not exists original_ended_at timestamptz;

comment on column public.time_log_entries.original_ended_at is
  'The end this timer had before an overnight fix moved it (ended_by ''overnight_fix''). Null unless fixed.';

create or replace function public.fix_overnight_timer(
  p_id uuid,
  p_end timestamptz,
  p_sleep_from timestamptz default null,
  p_sleep_until timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.time_log_entries;
begin
  select * into v from public.time_log_entries where id = p_id for update;
  if not found then
    raise exception 'That timer isn''t there any more.';
  end if;
  if v.ended_at is null or v.ended_by is not null then
    raise exception 'That timer has already been sorted out.';
  end if;
  if v.category = 'Sleep' or 'Sleep' = any(coalesce(v.tags, '{}'::text[])) then
    raise exception 'Sleep doesn''t need fixing.';
  end if;
  if p_end is null or p_end <= v.started_at or p_end >= v.ended_at then
    raise exception 'The new end has to fall while the timer ran.';
  end if;
  if p_sleep_from is not null and (
    p_sleep_until is null or p_sleep_from < p_end or p_sleep_until <= p_sleep_from or p_sleep_until > v.ended_at
  ) then
    raise exception 'Sleep has to fall between the new end and when the timer stopped.';
  end if;

  update public.time_log_entries
     set original_ended_at = v.ended_at, ended_at = p_end, ended_by = 'overnight_fix'
   where id = p_id;

  if p_sleep_from is not null then
    insert into public.time_log_entries (user_id, category, tags, started_at, ended_at, split_from, ended_by)
    values (v.user_id, 'Sleep', array['Sleep'], p_sleep_from, p_sleep_until, p_id, 'overnight_fix');
  end if;
end;
$$;

revoke all on function public.fix_overnight_timer(uuid, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.fix_overnight_timer(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
