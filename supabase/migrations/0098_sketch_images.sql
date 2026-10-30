-- Pictures on a task (Aaron, 2026-10-30): "I need to be able to paste an
-- image in a task and have it show up as an image." A pasted picture is kept
-- as one of the row's sketches with nothing drawn on it: its file in his own
-- folder of the note-images bucket, its size as the page's. So it sits with
-- the row's sketches, goes where the row goes, opens up close the same way,
-- and takes pins (0096).
--
--   sketches.image_path   the picture's file, or null for a drawing
--
-- Additive only: one column, and the policy now also checks that a
-- picture's file is in his own folder. To undo it, drop the column in the
-- SQL Editor and put the policy's check back as 0088 had it.

alter table public.sketches add column if not exists image_path text check (image_path is null or length(image_path) between 3 and 500);

alter policy "Own sketches" on public.sketches
  with check (
    user_id = auth.uid()
    and (quest_task_id is null or exists (select 1 from public.quest_tasks t where t.id = quest_task_id and t.user_id = auth.uid()))
    and (camp_step_id is null or exists (select 1 from public.camp_steps s where s.id = camp_step_id and s.user_id = auth.uid()))
    and (image_path is null or (storage.foldername(image_path))[1] = auth.uid()::text)
  );
