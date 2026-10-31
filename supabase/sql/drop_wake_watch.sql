-- Removes what's left of Wake watch, including its logged mornings
-- (wake_reports) and the peer you added (wake_peers). This can't be undone.
--
-- Not a migration: run it by hand in the Supabase SQL Editor only once you've
-- decided you don't want that data. 0099_wake_watch_off already stopped the
-- job, so leaving these tables in place costs nothing.

select cron.unschedule(jobid) from cron.job where jobname = 'wake-watch';

drop function if exists public.wake_watch_tick();
drop function if exists public.trigger_wake_send(uuid);
drop function if exists public.wake_time(uuid, date, text);
drop table if exists public.wake_reports, public.wake_peers, public.wake_watch;
drop function if exists public.wake_watch_stamp();
