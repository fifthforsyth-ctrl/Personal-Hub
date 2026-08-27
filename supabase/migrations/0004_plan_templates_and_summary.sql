-- Presets (reusable blocks and whole days) + the aggregate query behind the
-- month/year overview grids.
--
-- One template shape covers both kinds: a 'chunk' preset is a template with
-- exactly one template_chunk, a 'day' preset has several. Keeps applying,
-- editing, and listing uniform instead of two parallel sets of tables.

create type public.template_kind as enum ('chunk', 'day');

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.template_kind not null,
  energy_tag text,
  created_at timestamptz not null default now()
);

create index plan_templates_user_idx on public.plan_templates(user_id, kind);

alter table public.plan_templates enable row level security;

create policy "own plan templates" on public.plan_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.template_chunks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan_templates(id) on delete cascade,
  title text not null,
  start_time time not null,
  end_time time not null,
  goal_node_id uuid references public.nodes(id) on delete set null,
  position integer not null default 0
);

create index template_chunks_template_idx on public.template_chunks(template_id);

alter table public.template_chunks enable row level security;

create policy "own template chunks" on public.template_chunks
  for all using (
    exists (select 1 from public.plan_templates t where t.id = template_chunks.template_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.plan_templates t where t.id = template_chunks.template_id and t.user_id = auth.uid())
  );

create table public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_chunk_id uuid not null references public.template_chunks(id) on delete cascade,
  parent_id uuid references public.template_tasks(id) on delete cascade,
  title text not null,
  goal_node_id uuid references public.nodes(id) on delete set null,
  position integer not null default 0
);

create index template_tasks_chunk_idx on public.template_tasks(template_chunk_id);

alter table public.template_tasks enable row level security;

create policy "own template tasks" on public.template_tasks
  for all using (
    exists (
      select 1 from public.template_chunks c
      join public.plan_templates t on t.id = c.template_id
      where c.id = template_tasks.template_chunk_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.template_chunks c
      join public.plan_templates t on t.id = c.template_id
      where c.id = template_tasks.template_chunk_id and t.user_id = auth.uid()
    )
  );

-- Stamps a template onto a date: every template_chunk becomes a real
-- time_chunk, every template_task a real task (sub-tasks included, parents
-- resolved first so the child's parent_task_id points at the new row).
-- Server-side so applying a full day preset is one round trip, not dozens.
create function public.apply_plan_template(p_template_id uuid, p_date date)
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
    insert into public.time_chunks (user_id, date, start_time, end_time, title, goal_node_id)
    values (v_template.user_id, p_date, v_tc.start_time, v_tc.end_time, v_tc.title, v_tc.goal_node_id)
    returning id into v_new_chunk_id;
    v_chunk_count := v_chunk_count + 1;

    -- Parents before children (nulls first) so a sub-task always finds its
    -- freshly-created parent id in v_task_map.
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

-- Saves an existing planned day back out as a reusable day preset.
create function public.save_day_as_template(p_date date, p_name text)
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
    insert into public.template_chunks (template_id, title, start_time, end_time, goal_node_id)
    values (v_template_id, v_chunk.title, v_chunk.start_time, v_chunk.end_time, v_chunk.goal_node_id)
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

-- Per-day rollup for the month and year overview grids: one round trip for
-- a whole month (or a whole year) instead of a query per day.
--
-- NOTE: superseded by 0005, which adds the p_tz parameter — logged time has
-- to bucket by the caller's LOCAL day, not UTC, or an evening entry lands
-- on tomorrow. Applying fresh? Use 0005's definition instead of this one.
create function public.plan_summary(p_start date, p_end date)
returns table (
  day date,
  chunk_count integer,
  task_count integer,
  done_count integer,
  logged_minutes numeric
)
language sql
security definer
set search_path to 'public'
as $$
  with days as (
    select d::date as day from generate_series(p_start, p_end, interval '1 day') d
  ),
  chunk_agg as (
    select date, count(*)::integer as n from public.time_chunks
    where user_id = auth.uid() and date between p_start and p_end
    group by date
  ),
  task_agg as (
    select date,
           count(*)::integer as n,
           count(*) filter (where status)::integer as done
    from public.tasks
    where user_id = auth.uid() and date between p_start and p_end and parent_task_id is null
    group by date
  ),
  logged_agg as (
    select (started_at at time zone 'UTC')::date as date, sum(coalesce(duration_minutes, 0)) as mins
    from public.time_log_entries
    where user_id = auth.uid()
      and started_at >= p_start::timestamptz
      and started_at < (p_end + 1)::timestamptz
    group by 1
  )
  select days.day,
         coalesce(chunk_agg.n, 0),
         coalesce(task_agg.n, 0),
         coalesce(task_agg.done, 0),
         coalesce(logged_agg.mins, 0)
  from days
  left join chunk_agg on chunk_agg.date = days.day
  left join task_agg on task_agg.date = days.day
  left join logged_agg on logged_agg.date = days.day
  order by days.day;
$$;
