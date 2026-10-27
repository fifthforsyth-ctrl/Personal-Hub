-- An ongoing list on each quest, and colours on camp sections (Aaron,
-- 2026-10-27).
--
-- Beside its days, a quest keeps one list that isn't tied to a day: what
-- stays true of the quest until it's done. A line on it is marked ongoing;
-- its day stays the day it was written, and ticking it still sets done_on,
-- so the village counts it the same as any other task. Its sub-tasks go
-- with it.
--
-- A camp section can wear a colour he picks, the same way a step can
-- (0088). The app keeps the palette.
--
-- Additive only: two columns and an index. To undo it, remove the index and
-- the two columns in the SQL Editor; nothing else points at them.

alter table public.quest_tasks add column if not exists ongoing boolean not null default false;
create index if not exists quest_tasks_ongoing on public.quest_tasks (quest_id, position) where ongoing;

alter table public.camp_sections add column if not exists color text check (color is null or color ~ '^[a-z]{3,12}$');
