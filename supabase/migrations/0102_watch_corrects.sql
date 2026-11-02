-- The watch sets your hand-logged sleep and exercise right, once.
--
-- You still log sleep and exercise yourself (Going to bed, I'm up, the
-- morning check-in, a past entry) when the watch isn't linked yet or wasn't
-- on. When the watch's night or workout arrives later, the `watch` function
-- now moves that entry's times to the watch's, and keeps yours beside them.
-- It does that once per entry: after the watch has set or checked an
-- entry, a time you change is yours and stays.
--
--   time_log_entries
--     watch_fixed_at   when the watch set this entry's times, or checked
--                      them and found them within 5 minutes; null until
--                      then. The watch only ever moves an entry while
--                      this is null.
--     hand_started_at  the start you gave, before the watch moved it
--     hand_ended_at    the end you gave, before the watch moved it
--                      (both null unless the watch moved the entry; when
--                      the watch ends a Sleep timer that was still
--                      running and moves its start, only hand_started_at
--                      is set, since you never gave that entry an end)
--
-- Backfill: entries the import itself made already carry the watch's
-- times, so they're stamped with when they were made. That's the Exercise
-- entries a health_workouts row points at that the import inserted (source
-- 'watch' and made with the workout, or still on its times), and the Sleep
-- entries with source 'watch' that sit on a night's sleep_start and
-- sleep_end to the minute. A timer you started from the wrist also has
-- source 'watch', but its times are yours, so it isn't stamped and the
-- watch can still set it right.
--
-- No constraint changes: `source` and `ended_by` keep their checks.
--
-- Apply this before deploying the `watch` function that writes these
-- columns, and before the app that reads them goes live.
--
-- Purely additive.
--
-- To put the watch's moves back (SQL Editor). A Sleep timer the watch
-- ended keeps the watch's end, since it never had one of yours.
-- watch_fixed_at stays, so the watch leaves them as put back. Add
-- `and id = '<entry id>'` to put back just one.
--   update public.time_log_entries
--      set started_at = hand_started_at,
--          ended_at = coalesce(hand_ended_at, ended_at)
--    where hand_started_at is not null;
--
-- Rollback (SQL Editor; deploy the earlier `watch` function first, then
-- drop only what this file added):
--   alter table public.time_log_entries drop column if exists hand_ended_at;
--   alter table public.time_log_entries drop column if exists hand_started_at;
--   alter table public.time_log_entries drop column if exists watch_fixed_at;

alter table public.time_log_entries
  add column if not exists watch_fixed_at timestamptz,
  add column if not exists hand_started_at timestamptz,
  add column if not exists hand_ended_at timestamptz;

comment on column public.time_log_entries.watch_fixed_at is
  'When the watch set (or checked) this entry''s times. The watch only moves an entry while this is null.';
comment on column public.time_log_entries.hand_started_at is
  'The start you gave, before the watch moved it.';
comment on column public.time_log_entries.hand_ended_at is
  'The end you gave, before the watch moved it.';

-- Exercise entries the import made for a workout.
update public.time_log_entries t
   set watch_fixed_at = t.created_at
  from public.health_workouts w
 where w.time_entry_id = t.id
   and w.user_id = t.user_id
   and t.source = 'watch'
   and t.watch_fixed_at is null
   and t.ended_at is not null
   and (t.category = 'Exercise' or 'Exercise' = any (t.tags))
   and (
     abs(extract(epoch from (t.created_at - w.created_at))) <= 120
     or (abs(extract(epoch from (t.started_at - w.started_at))) <= 60
         and abs(extract(epoch from (t.ended_at - w.ended_at))) <= 60)
   );

-- Sleep entries the import made for a night.
update public.time_log_entries t
   set watch_fixed_at = t.created_at
  from public.health_days d
 where d.user_id = t.user_id
   and t.source = 'watch'
   and t.watch_fixed_at is null
   and t.ended_at is not null
   and (t.category = 'Sleep' or 'Sleep' = any (t.tags))
   and d.sleep_start is not null
   and d.sleep_end is not null
   and abs(extract(epoch from (t.started_at - d.sleep_start))) <= 60
   and abs(extract(epoch from (t.ended_at - d.sleep_end))) <= 60;
