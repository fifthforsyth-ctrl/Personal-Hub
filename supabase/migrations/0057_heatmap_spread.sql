-- "When the hours happen" on Charts. Apply after 0056.
--
-- productivity_heatmap put an entry's whole duration in the hour it started,
-- so a night's sleep logged at 10pm filled that one square with eight hours
-- and washed every other square out to near-white. Now:
--
--   * minutes are spread across the clock hours an entry actually covers
--     (9:40–11:15 gives 9am 20 min, 10am 60, 11am 15);
--   * Rest-family categories (Sleep) are left out, so the map shows the
--     waking day;
--   * entry_count counts entries, not hour slices.
--
-- Hours are stepped in real time and labelled in the user's zone, so a DST
-- change neither loses nor invents an hour. An entry still belongs to the
-- range by when it started, like the other reflection rollups. Same
-- signature and return shape, so the current app keeps working.

create or replace function public.productivity_heatmap(p_start date, p_end date, p_tz text default 'UTC')
returns table(day_of_week integer, hour_of_day integer, total_minutes numeric, entry_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with entries as (
    select t.id, t.started_at, t.ended_at
    from public.time_log_entries t
    where t.user_id = auth.uid()
      and t.ended_at > t.started_at
      and t.started_at >= (p_start::timestamp at time zone p_tz)
      and t.started_at < ((p_end + 1)::timestamp at time zone p_tz)
      and not exists (
        select 1 from public.user_categories c
        where c.user_id = t.user_id and c.name = t.category and c.family = 'Rest'
      )
  ),
  slices as (
    select e.id,
           h at time zone p_tz as local_hour,
           extract(epoch from least(e.ended_at, h + interval '1 hour') - greatest(e.started_at, h)) / 60 as minutes
    from entries e
    cross join lateral generate_series(
      date_trunc('hour', e.started_at, p_tz),
      e.ended_at - interval '1 microsecond',
      interval '1 hour'
    ) as h
  )
  select extract(dow from local_hour)::integer,
         extract(hour from local_hour)::integer,
         round(sum(minutes)::numeric, 1),
         count(distinct id)::integer
  from slices
  group by 1, 2
  order by 1, 2;
$$;

revoke execute on function public.productivity_heatmap(date, date, text) from public, anon;
grant execute on function public.productivity_heatmap(date, date, text) to authenticated, service_role;
