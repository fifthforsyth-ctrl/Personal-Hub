-- A sub-task's parent check, without the policy reading its own table.
--
-- 0081's "Own quest tasks" checked a sub-task's parent with a query on
-- quest_tasks inside quest_tasks' own policy, which Postgres refuses as
-- infinite recursion (every insert failed). The same check now runs in a
-- function that reads the table directly, still only for your own rows.
--
-- Additive only: one new function and the policy's check rewritten. To undo
-- it, put the check back to its 0081 form and remove the function in the
-- SQL Editor.

create or replace function public.quest_task_parent_ok(p_parent uuid, p_quest uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quest_tasks t
    where t.id = p_parent and t.user_id = auth.uid() and t.quest_id = p_quest
  );
$$;

revoke all on function public.quest_task_parent_ok(uuid, uuid) from public, anon;
grant execute on function public.quest_task_parent_ok(uuid, uuid) to authenticated;

alter policy "Own quest tasks" on public.quest_tasks
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid())
    and (parent_id is null or public.quest_task_parent_ok(parent_id, quest_id))
  );
