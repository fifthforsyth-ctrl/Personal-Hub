-- Task lists that aren't targets (Aaron, 2026-11-22).
--
-- The task system (today's list, the ongoing list, camps with their
-- sections, the clipboard) moved out of Targets into a Tasks tab of its own,
-- "useful for lots of other things". A list made there is a quests row like
-- any other, so every table under it (quest_tasks, quest_camps, camp_steps,
-- camp_sections) works unchanged; `is_list` only keeps it off Targets: the
-- ladder, the range and the evening's shots read quests where it's false.
--
-- Additive only: one column with a default, nothing dropped or rewritten.

alter table public.quests add column if not exists is_list boolean not null default false;

comment on column public.quests.is_list is
  'A plain task list made on the Tasks tab: never a target (kept off the ladder, the range and the evening''s shots).';
