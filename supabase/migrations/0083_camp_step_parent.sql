-- Sub-steps: a camp step can sit under another step of the same camp.
--
-- A sub-step is a camp_steps row like any other (so a finished one lays its
-- bricks in the village and counts on the camp), with parent_id pointing at
-- the step it sits under. They nest as deep as you like: a sub-step can
-- have sub-steps of its own. Taking a step off takes everything under it.
--
-- The parent check runs in a function that reads the table directly, the
-- way 0082 does for quest tasks, since a policy on camp_steps can't query
-- camp_steps itself.
--
-- Additive only: one column, one index, one function, and the policy's check
-- widened. To undo it, put the "Own camp steps" check back to its 0079 form,
-- then remove the function and the column in the SQL Editor.

alter table public.camp_steps add column if not exists parent_id uuid references public.camp_steps(id) on delete cascade;

create index if not exists camp_steps_parent on public.camp_steps (parent_id) where parent_id is not null;

create or replace function public.camp_step_parent_ok(p_parent uuid, p_camp uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.camp_steps s
    where s.id = p_parent and s.user_id = auth.uid() and s.camp_id = p_camp
  );
$$;

revoke all on function public.camp_step_parent_ok(uuid, uuid) from public, anon;
grant execute on function public.camp_step_parent_ok(uuid, uuid) to authenticated;

alter policy "Own camp steps" on public.camp_steps
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.quest_camps c where c.id = camp_id and c.user_id = auth.uid())
    and (section_id is null or exists (
      select 1 from public.camp_sections s where s.id = section_id and s.user_id = auth.uid() and s.camp_id = camp_steps.camp_id
    ))
    and (parent_id is null or (parent_id <> id and public.camp_step_parent_ok(parent_id, camp_id)))
  );
