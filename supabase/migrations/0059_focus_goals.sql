-- Weekly focus goals.
--
-- What a week is FOR, set on Sunday. A focus goal is either a goal from the
-- tree or a line typed fresh ("just focus on patience this week"), and there
-- are as many as the week needs. Each one belongs to one week: next Sunday
-- you look back at it and keep it, adjust it or let it go, and keeping it
-- writes a new row for the new week (carried_from points back), so every
-- week keeps exactly what it was aiming at.
--
-- The evening asks of each one, "did today move it?". That answer is a
-- check-in: one row per goal per day, yes or not today. No answer is no row.

create table if not exists public.focus_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The Sunday the week starts on, the same week the rest of the app uses.
  week_start date not null check (extract(dow from week_start) = 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  node_id uuid references public.nodes(id) on delete set null,
  carried_from uuid references public.focus_goals(id) on delete set null,
  -- Set during the next Sunday's review. Null means not looked at yet.
  review text check (review in ('kept', 'adjusted', 'let_go')),
  reviewed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists focus_goals_user_week on public.focus_goals (user_id, week_start);

create table if not exists public.focus_checkins (
  goal_id uuid not null references public.focus_goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  moved boolean not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, date)
);

create index if not exists focus_checkins_user_date on public.focus_checkins (user_id, date);

alter table public.focus_goals enable row level security;
alter table public.focus_checkins enable row level security;

-- A goal can only point at your own tree, and a check-in only at your own
-- goal: the ids are guessable, so the policy checks rather than trusting them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_goals' and policyname = 'Own focus goals') then
    create policy "Own focus goals" on public.focus_goals
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (node_id is null or exists (select 1 from public.nodes n where n.id = node_id and n.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_checkins' and policyname = 'Own focus check-ins') then
    create policy "Own focus check-ins" on public.focus_checkins
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.focus_goals g where g.id = goal_id and g.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.focus_goals, public.focus_checkins from anon, public;
grant select, insert, update, delete on public.focus_goals, public.focus_checkins to authenticated;
