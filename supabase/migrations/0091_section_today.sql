-- A whole section on today (Aaron, 2026-10-27): "I also need to be able to
-- add entire sections to the 'today' panel". Picked, a camp's section shows
-- in Today with every step in it that's still to do (or done today), and a
-- step added to it later shows there too. Like a step (0090), it stays
-- where it is and nothing is copied.
--
-- today_on is the day it was picked for. Only today's picks show, so each
-- day's Today starts empty and nothing is carried forward (Aaron,
-- 2026-10-14); an older pick is a date nothing reads.
--
-- Additive only: one column. To undo it, remove the column in the SQL
-- Editor; nothing else points at it.

alter table public.camp_sections add column if not exists today_on date;
