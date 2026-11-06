-- A day preset no longer doubles a weekly block (review of PR #74,
-- 2026-11-06). save_day_as_template saves every block on the day, weekly
-- copies included, and the Week tab keeps weekly blocks when a preset
-- replaces a day, so applying that preset to a day that has the same weekly
-- block put a second copy (and its tasks) beside it.
--
-- apply_plan_template, for a day preset, now uses the day's weekly copy
-- instead of adding a second one when it has the same times and name
-- (lower-cased, trimmed), the rule the weekly stamp uses to adopt a block.
-- The preset block's tasks go onto that copy, leaving out any it already
-- has by name (so a preset put back on the day it came from adds nothing
-- twice). That also fixes presets saved before this. A single-block preset
-- is unchanged: tapping it always adds its block. Same signature, so grants
-- stay; nothing is dropped.

create or replace function public.apply_plan_template(p_template_id uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_template public.plan_templates;
  v_tc record;
  v_tt record;
  v_new_chunk_id uuid;
  v_new_task_id uuid;
  v_chunk_count integer := 0;
  v_task_map jsonb := '{}'::jsonb;
  v_reused boolean;
  v_parent uuid;
  v_existing_task uuid;
begin
  select * into v_template from public.plan_templates where id = p_template_id;
  if v_template is null then
    raise exception 'Template not found';
  end if;
  if auth.uid() is distinct from v_template.user_id then
    raise exception 'Not your template';
  end if;

  if v_template.energy_tag is not null then
    insert into public.day_plans (user_id, date, energy_tag)
    values (v_template.user_id, p_date, v_template.energy_tag)
    on conflict (user_id, date) do update set energy_tag = excluded.energy_tag;
  end if;

  for v_tc in
    select * from public.template_chunks where template_id = p_template_id order by position, start_time
  loop
    -- A weekly block already on the day is this same block: a day preset
    -- saved from a day with it would otherwise put it there twice. Same
    -- match as the weekly stamp's own (_stamp_standing_blocks).
    v_new_chunk_id := null;
    if v_template.kind = 'day' then
      select c.id into v_new_chunk_id from public.time_chunks c
       where c.user_id = v_template.user_id and c.date = p_date
         and c.standing_block_id is not null
         and c.start_time = v_tc.start_time and c.end_time = v_tc.end_time
         and lower(trim(c.title)) = lower(trim(v_tc.title))
       limit 1;
    end if;
    v_reused := v_new_chunk_id is not null;

    if v_reused then
      update public.time_chunks set goal_node_id = v_tc.goal_node_id
       where id = v_new_chunk_id and goal_node_id is null and v_tc.goal_node_id is not null;
    else
      insert into public.time_chunks (user_id, date, start_time, end_time, title, goal_node_id, category, color)
      values (v_template.user_id, p_date, v_tc.start_time, v_tc.end_time, v_tc.title, v_tc.goal_node_id, v_tc.category, v_tc.color)
      returning id into v_new_chunk_id;
      v_chunk_count := v_chunk_count + 1;
    end if;

    for v_tt in
      select * from public.template_tasks
      where template_chunk_id = v_tc.id
      order by (parent_id is not null), position
    loop
      v_parent := case when v_tt.parent_id is null then null else (v_task_map ->> v_tt.parent_id::text)::uuid end;

      -- On a weekly copy, a task it already has (same name, same parent)
      -- isn't added again; its sub-tasks are matched under it.
      v_existing_task := null;
      if v_reused then
        select t.id into v_existing_task from public.tasks t
         where t.user_id = v_template.user_id
           and t.parent_task_id is not distinct from v_parent
           and (v_parent is not null or t.time_chunk_id = v_new_chunk_id)
           and lower(trim(t.title)) = lower(trim(v_tt.title))
         limit 1;
      end if;
      if v_existing_task is not null then
        v_task_map := jsonb_set(v_task_map, array[v_tt.id::text], to_jsonb(v_existing_task::text));
        continue;
      end if;

      insert into public.tasks (user_id, date, time_chunk_id, parent_task_id, title, goal_node_id, position)
      values (
        v_template.user_id,
        p_date,
        v_new_chunk_id,
        v_parent,
        v_tt.title,
        v_tt.goal_node_id,
        v_tt.position
      )
      returning id into v_new_task_id;

      v_task_map := jsonb_set(v_task_map, array[v_tt.id::text], to_jsonb(v_new_task_id::text));
    end loop;
  end loop;

  return v_chunk_count;
end;
$$;
