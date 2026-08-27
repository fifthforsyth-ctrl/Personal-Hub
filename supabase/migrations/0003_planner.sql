-- Phase 2 — Daily Planning & Time-Chunking (Section 4.2 of the vision doc).
--
-- The block (time_chunk) is the unit of planning; tasks (optionally
-- sub-tasks, one level deep) live underneath it. A task can also be
-- unscheduled (time_chunk_id null) — landed on today via rollover, or
-- added before it's been slotted into a block. Same private-by-default RLS
-- as everything else in this schema.

create table public.day_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  energy_tag text,
  primary key (user_id, date)
);

alter table public.day_plans enable row level security;

create policy "own day plans" on public.day_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.time_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  goal_node_id uuid references public.nodes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index time_chunks_user_date_idx on public.time_chunks(user_id, date);

alter table public.time_chunks enable row level security;

create policy "own time chunks" on public.time_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time_chunk_id uuid references public.time_chunks(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  date date not null,
  status boolean not null default false,
  goal_node_id uuid references public.nodes(id) on delete set null,
  rollover_count integer not null default 0,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_date_idx on public.tasks(user_id, date);
create index tasks_time_chunk_idx on public.tasks(time_chunk_id);
create index tasks_parent_idx on public.tasks(parent_task_id);

alter table public.tasks enable row level security;

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rolls every incomplete task dated before today forward to today —
-- unscheduled (its old time block has passed), with rollover_count bumped
-- so "moved N days in a row" stays visible instead of silently vanishing.
-- Only top-level tasks move on their own; a sub-task rolls implicitly by
-- staying attached to its (now-rolled) parent, so its own date is bumped
-- to match rather than trailing behind it.
create function public.rollover_incomplete_tasks()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  with rolled as (
    update public.tasks
    set date = current_date,
        time_chunk_id = null,
        rollover_count = rollover_count + 1,
        updated_at = now()
    where user_id = auth.uid()
      and status = false
      and date < current_date
      and parent_task_id is null
    returning id
  )
  select count(*) into v_count from rolled;

  update public.tasks t
  set date = current_date, updated_at = now()
  where t.user_id = auth.uid()
    and t.status = false
    and t.date < current_date
    and t.parent_task_id is not null
    and exists (select 1 from public.tasks p where p.id = t.parent_task_id and p.date = current_date);

  return v_count;
end;
$$;
