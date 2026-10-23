-- Dragons: the wins purse, the eggs it buys and the dragons they hatch into
-- (2026-10-23).
--
-- Aaron, 2026-10-23: "start me with 100 and go ahead and build all this in
-- the hub". Tasks build the village; wins raise the dragons. Every win he
-- logs after the purse started puts one in it, and he spends them on eggs
-- and on training the dragons that hatch. Spending never touches
-- win_losses, and a loss never takes a win out.
--
--   dragon_purse    one row: what it started with (100) and when, so only
--                   wins logged after that count
--   dragons         one per egg: its kind, the name he gives it, the
--                   phone's day it was bought, whether it was the one free
--                   egg, and the day it hatched once the app has seen it
--   dragon_spends   every spend: the egg itself (0 for the free one), then
--                   each stage of training in order (fledgling, flier,
--                   rider), with what it cost and the phone's day
--
-- The balance is the start, plus every win (kind 'win', not a sample)
-- logged after started_at, minus everything spent. Nothing stores it, so it
-- can't drift from the wins. An egg hatches on the third banked day on or
-- after both the day it was bought and the day the hatchery stood, and the
-- app works that out (the hatchery's day comes from how the village hands
-- out finished tasks); until then, unbanking a day takes its warmth back.
-- The first time the app sees an egg hatched it keeps the day
-- (dragon_hatch), so the dragon stays hatched for good: a task unticked
-- later can move the day the hatchery stood, but never turns it back into
-- an egg.
--
--   dragon_buy(kind, free, today, name)    buys an egg, or takes the free one
--   dragon_train(dragon, today, stage)     trains a dragon its next stage
--   dragon_hatch(dragon, today, on)        keeps the day an egg hatched
--
-- dragon_buy and dragon_train lock the purse row before they look at the
-- balance, so two taps at once (or two devices) are taken one after the
-- other and the second sees what the first spent. The prices live here,
-- not in the app: the app only says what he wants. The app can't write
-- these tables itself, apart from naming a dragon.
--
-- Additive only: three new tables, four functions, and Aaron's purse
-- (started with 100 when he asked for it, at the end of this file).
--
-- Rollback (Aaron, in the SQL Editor): remove the four functions
-- dragon_buy(text, boolean, date, text), dragon_train(uuid, date, text),
-- dragon_hatch(uuid, date, date) and dragon_balance(uuid), then the three
-- tables dragon_spends, dragons and dragon_purse. Nothing else changes.

create table if not exists public.dragon_purse (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  start_wins integer not null default 100 check (start_wins >= 0),
  started_at timestamptz not null default now()
);

create table if not exists public.dragons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('boulder', 'crest', 'dawn', 'ember', 'night')),
  -- He names each one himself, whenever he likes. Null until he does.
  name text check (name is null or length(btrim(name)) between 1 and 40),
  bought_on date not null,
  free boolean not null default false,
  -- The banked day it hatched on, kept the first time the app sees it
  -- hatched (dragon_hatch). Null while it's an egg.
  hatched_on date check (hatched_on is null or hatched_on >= bought_on),
  created_at timestamptz not null default now()
);

-- One free egg, ever.
create unique index if not exists dragons_one_free on public.dragons (user_id) where free;
create index if not exists dragons_user on public.dragons (user_id, bought_on, created_at);

create table if not exists public.dragon_spends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dragon_id uuid not null references public.dragons(id) on delete cascade,
  what text not null check (what in ('egg', 'fledgling', 'flier', 'rider')),
  cost integer not null check (cost >= 0),
  day date not null,
  created_at timestamptz not null default now(),
  -- Each egg is bought once and each stage trained once.
  unique (dragon_id, what)
);

create index if not exists dragon_spends_user on public.dragon_spends (user_id);

alter table public.dragon_purse enable row level security;
alter table public.dragons enable row level security;
alter table public.dragon_spends enable row level security;

-- Yours alone. You can read all three and rename your own dragons; every
-- other write goes through dragon_buy, dragon_train and dragon_hatch below.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dragon_purse' and policyname = 'Own dragon purse') then
    create policy "Own dragon purse" on public.dragon_purse
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dragons' and policyname = 'Own dragons') then
    create policy "Own dragons" on public.dragons
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dragons' and policyname = 'Name own dragons') then
    create policy "Name own dragons" on public.dragons
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dragon_spends' and policyname = 'Own dragon spends') then
    create policy "Own dragon spends" on public.dragon_spends
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;

-- New tables here come with every privilege for authenticated by default
-- (truncate included, which RLS doesn't cover), so those are taken back
-- first and only reading, and renaming a dragon, given.
revoke all on public.dragon_purse, public.dragons, public.dragon_spends from anon, public, authenticated;
grant select on public.dragon_purse, public.dragons, public.dragon_spends to authenticated;
grant update (name) on public.dragons to authenticated;

-- What's in the purse now. Only the two functions below call it, after
-- they've locked the purse row; a purse that hasn't started yet holds the
-- 100 it will start with.
create or replace function public.dragon_balance(p_user uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce((
      select p.start_wins + (
        select count(*)::integer from public.win_losses w
        where w.user_id = p.user_id
          and w.kind = 'win'
          and not w.is_example
          and w.occurred_at > p.started_at
      )
      from public.dragon_purse p
      where p.user_id = p_user
    ), 100)
    - coalesce((select sum(s.cost)::integer from public.dragon_spends s where s.user_id = p_user), 0);
$$;

revoke all on function public.dragon_balance(uuid) from public, anon, authenticated;

-- Buys an egg of `p_kind` on the phone's day, or takes the free egg when
-- `p_free` (any kind, once ever). The app checks that the hatchery stands
-- before it offers the free egg; a bought egg can come any time and waits
-- for the hatchery. Returns the new dragon.
create or replace function public.dragon_buy(p_kind text, p_free boolean, p_today date, p_name text default null)
returns public.dragons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_free boolean := coalesce(p_free, false);
  v_cost integer;
  v_dragon public.dragons;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  -- The phone's day is always within a day of the server's: anything
  -- further out would let an egg be bought on a day already banked.
  if p_today is null or p_today not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'Check the date on your phone.';
  end if;
  v_cost := case p_kind
    when 'boulder' then 40 when 'crest' then 50 when 'dawn' then 70
    when 'ember' then 90 when 'night' then 150 end;
  if v_cost is null then
    raise exception 'There is no egg of that kind.';
  end if;

  -- The purse starts the first time it's used, if it hasn't already, and
  -- is held until this is done.
  insert into public.dragon_purse (user_id) values (v_user) on conflict (user_id) do nothing;
  perform 1 from public.dragon_purse where user_id = v_user for update;

  if v_free then
    if exists (select 1 from public.dragons where user_id = v_user and free) then
      raise exception 'The free egg has already been taken.';
    end if;
    v_cost := 0;
  elsif public.dragon_balance(v_user) < v_cost then
    raise exception 'Not enough wins in the purse for that egg yet.';
  end if;

  insert into public.dragons (user_id, kind, name, bought_on, free)
  values (v_user, p_kind, nullif(btrim(coalesce(p_name, '')), ''), p_today, v_free)
  returning * into v_dragon;
  insert into public.dragon_spends (user_id, dragon_id, what, cost, day)
  values (v_user, v_dragon.id, 'egg', v_cost, p_today);
  return v_dragon;
end;
$$;

revoke all on function public.dragon_buy(text, boolean, date, text) from public, anon;
grant execute on function public.dragon_buy(text, boolean, date, text) to authenticated;

-- Trains one of his dragons its next stage, in order: fledgling 30, flier
-- 60, rider's dragon 120. `p_stage`, when given, is the stage he tapped: if
-- the dragon already has it (a second tap, or a retry of one that went
-- through), nothing more is spent and that spend comes back, so one tap
-- can never train two stages. Hatching is worked out in the app, so the
-- first stage only checks what can be checked here: three banked days
-- since the egg was bought, unless dragon_hatch has already kept the day it
-- hatched. A dragon once trained stays hatched. Returns the spend.
create or replace function public.dragon_train(p_dragon uuid, p_today date, p_stage text default null)
returns public.dragon_spends
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dragon public.dragons;
  v_next text;
  v_cost integer;
  v_spend public.dragon_spends;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  if p_today is null or p_today not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'Check the date on your phone.';
  end if;

  insert into public.dragon_purse (user_id) values (v_user) on conflict (user_id) do nothing;
  perform 1 from public.dragon_purse where user_id = v_user for update;

  select * into v_dragon from public.dragons where id = p_dragon and user_id = v_user;
  if v_dragon.id is null then
    raise exception 'That dragon isn''t one of yours.';
  end if;
  if not exists (select 1 from public.dragon_spends where dragon_id = v_dragon.id and what = 'egg') then
    raise exception 'That dragon has no egg on record.';
  end if;
  if p_stage in ('fledgling', 'flier', 'rider') then
    select * into v_spend from public.dragon_spends where dragon_id = v_dragon.id and what = p_stage;
    if v_spend.id is not null then
      return v_spend;
    end if;
  end if;

  -- The first stage it hasn't been trained in yet.
  select s.what, s.cost into v_next, v_cost
  from (values (1, 'fledgling', 30), (2, 'flier', 60), (3, 'rider', 120)) as s(n, what, cost)
  where not exists (select 1 from public.dragon_spends d where d.dragon_id = v_dragon.id and d.what = s.what)
  order by s.n
  limit 1;
  if v_next is null then
    raise exception 'It is already a rider''s dragon.';
  end if;
  if p_stage is not null and p_stage <> v_next then
    raise exception 'It trains one stage at a time, in order.';
  end if;
  if v_next = 'fledgling' and v_dragon.hatched_on is null and (
    select count(*) from public.day_plans
    where user_id = v_user and banked_at is not null and not is_example
      and date >= v_dragon.bought_on and date <= p_today
  ) < 3 then
    raise exception 'That egg hasn''t hatched yet.';
  end if;
  if public.dragon_balance(v_user) < v_cost then
    raise exception 'Not enough wins in the purse for that yet.';
  end if;

  insert into public.dragon_spends (user_id, dragon_id, what, cost, day)
  values (v_user, v_dragon.id, v_next, v_cost, p_today)
  returning * into v_spend;
  return v_spend;
end;
$$;

revoke all on function public.dragon_train(uuid, date, text) from public, anon;
grant execute on function public.dragon_train(uuid, date, text) to authenticated;

-- Keeps the day an egg hatched (`p_on`, the banked day it hatched on), the
-- first time the app sees it hatched, so it stays a dragon whatever happens
-- to the village afterwards. The hatchery standing is worked out in the
-- app, so this checks what can be checked here: three banked days from the
-- day the egg was bought to that day. A day already kept stays as it is.
-- Returns the dragon.
create or replace function public.dragon_hatch(p_dragon uuid, p_today date, p_on date)
returns public.dragons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dragon public.dragons;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  if p_today is null or p_today not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'Check the date on your phone.';
  end if;

  select * into v_dragon from public.dragons where id = p_dragon and user_id = v_user for update;
  if v_dragon.id is null then
    raise exception 'That dragon isn''t one of yours.';
  end if;
  if v_dragon.hatched_on is not null then
    return v_dragon;
  end if;
  if p_on is null or p_on < v_dragon.bought_on or p_on > p_today or (
    select count(*) from public.day_plans
    where user_id = v_user and banked_at is not null and not is_example
      and date >= v_dragon.bought_on and date <= p_on
  ) < 3 then
    raise exception 'That egg hasn''t hatched yet.';
  end if;

  update public.dragons set hatched_on = p_on where id = v_dragon.id
  returning * into v_dragon;
  return v_dragon;
end;
$$;

revoke all on function public.dragon_hatch(uuid, date, date) from public, anon;
grant execute on function public.dragon_hatch(uuid, date, date) to authenticated;

-- Aaron's purse, started with 100 at the moment he asked ("start me with
-- 100", 2026-10-23 19:40:51 UTC), so every win he has logged since counts.
-- Here rather than on his first spend, which would start it then and leave
-- out the wins in between. Only where his account exists (not on a branch
-- without him), and never over a purse that has already started.
insert into public.dragon_purse (user_id, start_wins, started_at)
select '49072ace-6e40-4280-8045-485c3d3d273d', 100, '2026-10-23 19:40:51+00'
where exists (select 1 from auth.users where id = '49072ace-6e40-4280-8045-485c3d3d273d')
on conflict (user_id) do nothing;
