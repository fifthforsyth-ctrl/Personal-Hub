-- "Working on it" for a quest's tasks too (Aaron, 2026-10-28): a small
-- button under a task's tick marks it as the thing he's on, the same as a
-- camp step's working_since (0086), and Today's board lifts it into a
-- "Working on" box at the top. Ticking it done clears it.
--
--   quest_tasks.working_since   when he started on it, null when he isn't
--
-- Additive only: one column. To undo it, drop the column in the SQL Editor.

alter table public.quest_tasks add column if not exists working_since timestamptz;
