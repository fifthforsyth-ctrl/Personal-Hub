-- Banking a day. Once the reflection is written, the minutes are linked and
-- tomorrow is planned, the day gets closed out: a synopsis written from
-- everything on it, and a timestamp marking it finished.
--
-- Both live on day_plans rather than a new table — a banked day IS a day plan
-- that has been completed, and a separate table would need the same
-- (user_id, date) key and the same RLS for no gain.
alter table public.day_plans
  add column if not exists banked_at timestamptz,
  add column if not exists synopsis text;

-- plan_summary grows two columns so the week and month grids can mark banked
-- days without a second query. The body is unchanged apart from the two new
-- selects; the return type changed, so it has to be dropped first.
drop function if exists public.plan_summary(date, date, text);

create function public.plan_summary(p_start date, p_end date, p_tz text default 'UTC'::text)
returns table (
  day date,
  chunk_count integer,
  task_count integer,
  done_count integer,
  logged_minutes numeric,
  energy_tag text,
  banked boolean
)
language sql
security definer
set search_path to 'public'
as $function$
  with days as (
    select d::date as day from generate_series(p_start, p_end, interval '1 day') d
  ),
  chunk_agg as (
    select date, count(*)::integer as n from public.time_chunks
    where user_id = auth.uid() and date between p_start and p_end
    group by date
  ),
  task_agg as (
    select date,
           count(*)::integer as n,
           count(*) filter (where status)::integer as done
    from public.tasks
    where user_id = auth.uid() and date between p_start and p_end and parent_task_id is null
    group by date
  ),
  logged_agg as (
    -- Shift each timestamp into the caller's zone before taking its date,
    -- and bound the scan by that zone's midnights too.
    select (started_at at time zone p_tz)::date as date,
           sum(coalesce(duration_minutes, 0)) as mins
    from public.time_log_entries
    where user_id = auth.uid()
      and started_at >= (p_start::timestamp at time zone p_tz)
      and started_at < ((p_end + 1)::timestamp at time zone p_tz)
    group by 1
  ),
  plan_agg as (
    select date, energy_tag, banked_at from public.day_plans
    where user_id = auth.uid() and date between p_start and p_end
  )
  select days.day,
         coalesce(chunk_agg.n, 0),
         coalesce(task_agg.n, 0),
         coalesce(task_agg.done, 0),
         coalesce(logged_agg.mins, 0),
         plan_agg.energy_tag,
         plan_agg.banked_at is not null
  from days
  left join chunk_agg on chunk_agg.date = days.day
  left join task_agg on task_agg.date = days.day
  left join logged_agg on logged_agg.date = days.day
  left join plan_agg on plan_agg.date = days.day
  order by days.day;
$function$;

grant execute on function public.plan_summary(date, date, text) to authenticated;
