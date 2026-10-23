-- A block of the day can be tagged with the quest (or one camp of it) it's
-- spent on, so the day's report can say what got done there: "today I'm on
-- the Multicam tab" and the Multicam steps finished today show up as work.
--
-- Additive only: two nullable columns and the policy's check widened so a
-- block can only point at your own quest and camp. To undo it, put the "own
-- time chunks" check back to (auth.uid() = user_id) and remove the two
-- columns in the SQL Editor.

alter table public.time_chunks
  add column if not exists quest_id uuid references public.quests(id) on delete set null,
  add column if not exists camp_id uuid references public.quest_camps(id) on delete set null;

alter policy "own time chunks" on public.time_chunks
  with check (
    auth.uid() = user_id
    and (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()))
    and (camp_id is null or exists (select 1 from public.quest_camps c where c.id = camp_id and c.user_id = auth.uid()))
  );
