-- Wake watch is gone (Aaron, 2026-10-31: the toll-free number was rejected).
--
-- This stops it for good without throwing anything away: the every-minute
-- morning job is unscheduled and the watch is switched off, so nothing is
-- judged or sent again. The page, the `wake` edge function and the public
-- opt-in page are removed in the same pull request.
--
-- The tables (wake_watch, wake_peers, wake_reports) and their functions stay
-- until Aaron decides about the data in them. Removing them for good is
-- supabase/sql/drop_wake_watch.sql, run by hand in the SQL Editor.
--
-- No DROP here. Undo: re-run the cron.schedule line from 0078 and set
-- enabled back to true.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wake-watch') then
    perform cron.unschedule('wake-watch');
  end if;
end $$;

update public.wake_watch set enabled = false where enabled;
