-- A colour for every time block (Aaron, 2026-11-06): the Week tab became a
-- schedule planner on a half-hour grid, and each block can wear one of a few
-- named colours that he chooses. The colour rides with the block into a
-- preset and back out of it, and with a weekly repeat onto every week.
--
-- Additive only: three nullable columns and three functions replaced with
-- the same signatures. Null means plain, the default.
--
--   * time_chunks.color, template_chunks.color, standing_blocks.color: a
--     colour's key ('orange', 'slate', ...), lower-case letters only.
--   * apply_plan_template: copies the colour, and the category too (it was
--     saved on template_chunks since 0039 but never copied back out).
--   * save_day_as_template: saves each block's colour and category.
--   * _stamp_standing_blocks: a weekly block's copies carry its colour.

alter table public.time_chunks
  add column if not exists color text check (color is null or color ~ '^[a-z]{1,16}$');

alter table public.template_chunks
  add column if not exists color text check (color is null or color ~ '^[a-z]{1,16}$');

alter table public.standing_blocks
  add column if not exists color text check (color is null or color ~ '^[a-z]{1,16}$');

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
    insert into public.time_chunks (user_id, date, start_time, end_time, title, goal_node_id, category, color)
    values (v_template.user_id, p_date, v_tc.start_time, v_tc.end_time, v_tc.title, v_tc.goal_node_id, v_tc.category, v_tc.color)
    returning id into v_new_chunk_id;
    v_chunk_count := v_chunk_count + 1;

    for v_tt in
      select * from public.template_tasks
      where template_chunk_id = v_tc.id
      order by (parent_id is not null), position
    loop
      insert into public.tasks (user_id, date, time_chunk_id, parent_task_id, title, goal_node_id, position)
      values (
        v_template.user_id,
        p_date,
        v_new_chunk_id,
        case when v_tt.parent_id is null then null else (v_task_map ->> v_tt.parent_id::text)::uuid end,
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

create or replace function public.save_day_as_template(p_date date, p_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_template_id uuid;
  v_chunk record;
  v_new_chunk_id uuid;
  v_task record;
  v_new_task_id uuid;
  v_task_map jsonb := '{}'::jsonb;
  v_energy text;
begin
  select energy_tag into v_energy from public.day_plans where user_id = auth.uid() and date = p_date;

  insert into public.plan_templates (user_id, name, kind, energy_tag)
  values (auth.uid(), p_name, 'day', v_energy)
  returning id into v_template_id;

  for v_chunk in
    select * from public.time_chunks where user_id = auth.uid() and date = p_date order by start_time
  loop
    insert into public.template_chunks (template_id, title, start_time, end_time, goal_node_id, category, color)
    values (v_template_id, v_chunk.title, v_chunk.start_time, v_chunk.end_time, v_chunk.goal_node_id, v_chunk.category, v_chunk.color)
    returning id into v_new_chunk_id;

    for v_task in
      select * from public.tasks
      where user_id = auth.uid() and time_chunk_id = v_chunk.id
      order by (parent_task_id is not null), position
    loop
      insert into public.template_tasks (template_chunk_id, parent_id, title, goal_node_id, position)
      values (
        v_new_chunk_id,
        case when v_task.parent_task_id is null then null else (v_task_map ->> v_task.parent_task_id::text)::uuid end,
        v_task.title,
        v_task.goal_node_id,
        v_task.position
      )
      returning id into v_new_task_id;

      v_task_map := jsonb_set(v_task_map, array[v_task.id::text], to_jsonb(v_new_task_id::text));
    end loop;
  end loop;

  return v_template_id;
end;
$$;

create or replace function public._stamp_standing_blocks(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_today date;
  v_block record;
  v_day date;
  v_existing uuid;
  v_count integer := 0;
begin
  select (now() at time zone coalesce(p.timezone, 'America/Denver'))::date into v_today
    from public.profiles p where p.id = p_user_id;
  v_today := coalesce(v_today, (now() at time zone 'America/Denver')::date);

  for v_block in
    select * from public.standing_blocks where user_id = p_user_id and active
  loop
    for v_day in
      select d::date from generate_series(
        greatest(v_today, coalesce(v_block.stamped_through + 1, v_today)),
        v_today + 56, interval '1 day') d
      where extract(dow from d) = v_block.weekday
    loop
      select c.id into v_existing from public.time_chunks c
       where c.user_id = p_user_id and c.date = v_day
         and c.start_time = v_block.start_time and c.end_time = v_block.end_time
         and lower(trim(c.title)) = lower(trim(v_block.title))
       limit 1;

      if v_existing is not null then
        update public.time_chunks
           set standing_block_id = v_block.id,
               source = 'commitment',
               category = coalesce(category, v_block.category),
               color = coalesce(color, v_block.color)
         where id = v_existing;
      else
        insert into public.time_chunks (user_id, date, start_time, end_time, title, category, color, source, standing_block_id)
        values (p_user_id, v_day, v_block.start_time, v_block.end_time, v_block.title, v_block.category, v_block.color, 'commitment', v_block.id);
        v_count := v_count + 1;
      end if;
    end loop;

    update public.standing_blocks set stamped_through = v_today + 56 where id = v_block.id;
  end loop;

  return v_count;
end;
$$;
