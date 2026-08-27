-- Personal Hub — Phase 0 (time log, win/loss, prayer log) + Goal Tree.
--
-- Everything here is strictly private to its owner: every RLS policy below
-- is `auth.uid() = user_id`, full stop. Unlike Symposium (a shared/community
-- app), there is no "viewable by all logged-in members" policy anywhere in
-- this schema — that's the load-bearing difference between the two.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Friend',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row the moment someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Goal tree — nodes + node_edges. Structurally the same idea as Symposium's
-- (ring depth *is* tier, computed from the graph, never stored), minus the
-- hiking/elevation gamification layer.
-- ---------------------------------------------------------------------------

create type public.tracking_method as enum ('checkbox', 'counter', 'note');

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  tracking_method public.tracking_method not null default 'checkbox',
  has_target_number boolean not null default false,
  target_number numeric,
  current_number numeric not null default 0,
  is_daily boolean not null default false,
  last_daily_check_date date,
  is_completed boolean not null default false,
  completed_at timestamptz,
  is_repeatable boolean not null default false,
  cycle_count integer not null default 0,
  has_deadline boolean not null default false,
  deadline_date date,
  collapsed boolean not null default false,
  is_focused boolean not null default false,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nodes_user_id_idx on public.nodes(user_id);

alter table public.nodes enable row level security;

create policy "own nodes" on public.nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.node_edges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.nodes(id) on delete cascade,
  parent_id uuid not null references public.nodes(id) on delete cascade,
  weight numeric,
  created_at timestamptz not null default now(),
  unique (child_id, parent_id)
);

comment on column public.node_edges.weight is
  'Relative weight of this child in a future weighted-progress roll-up. NULL = equal split among siblings.';

create index node_edges_child_idx on public.node_edges(child_id);
create index node_edges_parent_idx on public.node_edges(parent_id);

alter table public.node_edges enable row level security;

create policy "own edges" on public.node_edges
  for all using (
    exists (select 1 from public.nodes n where n.id = node_edges.child_id and n.user_id = auth.uid())
    and exists (select 1 from public.nodes n where n.id = node_edges.parent_id and n.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.nodes n where n.id = node_edges.child_id and n.user_id = auth.uid())
    and exists (select 1 from public.nodes n where n.id = node_edges.parent_id and n.user_id = auth.uid())
  );

create table public.progress_logs (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table public.progress_logs enable row level security;

create policy "own progress logs" on public.progress_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('daily_checkin', 'one_time')),
  created_at timestamptz not null default now()
);

alter table public.completions enable row level security;

create policy "own completions" on public.completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.node_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now()
);

alter table public.node_notes enable row level security;

create policy "own node notes" on public.node_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- last_activity_at drives the wheel's brightness (lib/heat.js) — bump it
-- whenever a node is directly engaged with, whichever way.
create function public.bump_node_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.nodes set last_activity_at = new.created_at where id = new.node_id;
  return new;
end;
$$;

create trigger bump_activity_on_progress
  after insert on public.progress_logs
  for each row execute function public.bump_node_activity();

create trigger bump_activity_on_completion
  after insert on public.completions
  for each row execute function public.bump_node_activity();

create trigger bump_activity_on_note
  after insert on public.node_notes
  for each row execute function public.bump_node_activity();

-- Checkbox (kind = 'daily_checkin' | 'one_time') and Counter completions
-- both funnel through here. No "internal" bypass flag — an earlier draft
-- had a p_internal param meant only for record_progress's own use, but any
-- authenticated caller can hit /rest/v1/rpc/record_completion directly with
-- whatever arguments they like, so a client-settable bypass flag is really
-- just a client-settable bypass. record_progress below sets completion
-- state inline instead of asking this function to trust it.
create function public.record_completion(p_node_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_node public.nodes;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;
  if p_kind not in ('daily_checkin', 'one_time') then
    raise exception 'Unknown completion kind';
  end if;

  insert into public.completions (node_id, user_id, kind) values (p_node_id, v_node.user_id, p_kind);

  if p_kind = 'daily_checkin' then
    update public.nodes set is_completed = true, last_daily_check_date = current_date, last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  else
    update public.nodes set is_completed = true, completed_at = now(), last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  end if;
end;
$$;

-- Counter tracking method: log an amount, roll it into current_number, and
-- auto-complete once the target is reached. Daily counters reset lazily (on
-- first interaction of a new day) rather than needing a cron job.
create function public.record_progress(p_node_id uuid, p_amount numeric default 1)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_node public.nodes;
  v_new_count numeric;
  v_kind text;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;
  if not v_node.has_target_number then
    raise exception 'This node has no target set';
  end if;

  if v_node.is_daily and (v_node.last_daily_check_date is null or v_node.last_daily_check_date <> current_date) then
    update public.nodes
    set current_number = 0, is_completed = false, last_daily_check_date = current_date, updated_at = now()
    where id = p_node_id;
    v_node.current_number := 0;
    v_node.is_completed := false;
  end if;

  if v_node.is_daily and v_node.is_completed then
    return;
  end if;

  insert into public.progress_logs (node_id, user_id, amount) values (p_node_id, v_node.user_id, p_amount);

  v_new_count := v_node.current_number + p_amount;

  update public.nodes
  set current_number = v_new_count,
      last_daily_check_date = case when v_node.is_daily then current_date else last_daily_check_date end,
      last_activity_at = now(),
      updated_at = now()
  where id = p_node_id;

  if v_new_count >= coalesce(v_node.target_number, 0) and not v_node.is_completed then
    v_kind := case when v_node.is_daily then 'daily_checkin' else 'one_time' end;
    insert into public.completions (node_id, user_id, kind) values (p_node_id, v_node.user_id, v_kind);
    if v_kind = 'daily_checkin' then
      update public.nodes set is_completed = true, last_daily_check_date = current_date, updated_at = now() where id = p_node_id;
    else
      update public.nodes set is_completed = true, completed_at = now(), updated_at = now() where id = p_node_id;
    end if;
  end if;
end;
$$;

-- Resets a completed, repeatable, non-daily node back to a fresh cycle.
create function public.repeat_node(p_node_id uuid, p_new_target numeric default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_node public.nodes;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if v_node is null then raise exception 'Node not found'; end if;
  if auth.uid() is distinct from v_node.user_id then raise exception 'Not your node'; end if;
  if not v_node.is_repeatable then raise exception 'This node is not marked repeatable'; end if;

  update public.nodes
  set current_number = 0,
      is_completed = false,
      completed_at = null,
      cycle_count = cycle_count + 1,
      target_number = coalesce(p_new_target, target_number),
      updated_at = now()
  where id = p_node_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phase 0 — Data layer: time log, win/loss log, prayer log.
-- ---------------------------------------------------------------------------

create table public.time_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subcategory text,
  description text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes numeric generated always as (
    case when ended_at is not null then round(extract(epoch from (ended_at - started_at)) / 60.0, 1) else null end
  ) stored,
  tags text[] not null default '{}',
  goal_node_id uuid references public.nodes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index time_log_user_started_idx on public.time_log_entries(user_id, started_at desc);

alter table public.time_log_entries enable row level security;

create policy "own time log entries" on public.time_log_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.win_losses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('win', 'loss')),
  habit_label text not null,
  goal_node_id uuid references public.nodes(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index win_losses_user_occurred_idx on public.win_losses(user_id, occurred_at desc);

alter table public.win_losses enable row level security;

create policy "own win losses" on public.win_losses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayed_at timestamptz not null default now(),
  context text,
  content text not null,
  felt_response text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index prayer_logs_user_prayed_idx on public.prayer_logs(user_id, prayed_at desc);

alter table public.prayer_logs enable row level security;

create policy "own prayer logs" on public.prayer_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
