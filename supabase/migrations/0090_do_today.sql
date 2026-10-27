-- "Do today" (Aaron, 2026-10-27): any step in a camp, or a line on a
-- quest's ongoing list or an earlier day's list, can be picked for today.
-- It doesn't move. It stays where it is and shows up again, as the same
-- row, in the camp's Today section and in the quest's Today on Quests, so a
-- tick, a note or a sub-step added in either place is the same tick, note
-- or sub-step.
--
-- today_on is the day it was picked for. Only today's picks show, so each
-- day's Today starts empty and nothing is carried forward (Aaron,
-- 2026-10-14); an older pick is a date nothing reads.
--
-- Additive only: two columns and two indexes. To undo it, remove the
-- indexes and the columns in the SQL Editor; nothing else points at them.

alter table public.camp_steps add column if not exists today_on date;
alter table public.quest_tasks add column if not exists today_on date;
create index if not exists camp_steps_today on public.camp_steps (camp_id, today_on) where today_on is not null;
create index if not exists quest_tasks_today on public.quest_tasks (quest_id, today_on) where today_on is not null;
