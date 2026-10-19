-- Ascent: the goals page that replaces the goal wheel.
--
-- Aaron's goals, top to bottom, in his words (2026-10-19). The mountain on
-- the page is only decoration around them:
--
--   mission         the summit, what everything else serves, for eternity
--   lifetime goals  the five root goals of the tree, renamed in his words
--   focuses         what feeds a lifetime goal day to day. A footprint is a
--                   day the time log has one of the focus's categories, so
--                   there is nothing new to log
--   quests          missions he feels God calling him to now, climbed camp
--                   by camp. A finished quest is kept as a patch
--   lessons         inspired changes to his character, kept or slipped with
--                   one honest tap a day
--
--   missions         one row each: the statement, and the few words on the
--                    summit flag
--   focuses          name, how it feeds its lifetime goal, and the time-log
--                    categories that count as a step
--   quests           title, why, what it serves (a lifetime goal, or the
--                    mission itself when goal_id is null), on / done /
--                    set_aside
--   quest_camps      the camps on the way up, each reached on a day or not yet
--   lessons          title, the evening's question, what it serves,
--                    learning / learned / set_aside
--   lesson_checkins  one row per lesson per day: kept or not. No answer is
--                    no row
--   ascent_steps()   for each time-log category: the days in the last
--                    p_days (ending on the phone's p_today) it was logged,
--                    and the last day it ever was
--
-- Additive, apart from the rename of the five root goals at the end.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop function if exists public.ascent_steps(date, integer, text);
--   drop table if exists public.lesson_checkins, public.lessons, public.quest_camps,
--     public.quests, public.focuses, public.missions;
-- and, to put the old names back on the root goals:
--   update public.nodes n set title = v.old_title, updated_at = now()
--   from (values ('Highly skilled', 'be highly skilled'), ('Highly in tune with God', 'in tune with God'),
--                ('Highly educated', 'Highly Educated'), ('Highly selfless', 'Highly Charitable'),
--                ('Highly disciplined', 'Highly Disciplined')) v(new_title, old_title)
--   where n.title = v.new_title and not exists (select 1 from public.node_edges e where e.child_id = n.id);

create table if not exists public.missions (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  statement text not null check (length(btrim(statement)) between 1 and 1000),
  -- The few words on the flag at the summit: "A trusted servant".
  summit text check (summit is null or length(btrim(summit)) between 1 and 60),
  updated_at timestamptz not null default now()
);

create table if not exists public.focuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The lifetime goal it feeds: one of the root goals of the tree.
  goal_id uuid not null references public.nodes(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  -- How it feeds the goal, in his words: "improves my skill".
  why text check (why is null or length(why) <= 200),
  categories text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists focuses_user on public.focuses (user_id, position);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  note text check (note is null or length(note) <= 2000),
  goal_id uuid references public.nodes(id) on delete set null,
  status text not null default 'on' check (status in ('on', 'done', 'set_aside')),
  started_on date,
  finished_on date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quests_user on public.quests (user_id, status);

create table if not exists public.quest_camps (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  -- The phone's day it was reached. Null while it's still ahead.
  reached_on date,
  created_at timestamptz not null default now()
);

create index if not exists quest_camps_quest on public.quest_camps (quest_id, position);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  -- What the day asks: "Did you go without caffeine today?"
  question text check (question is null or length(question) <= 300),
  goal_id uuid references public.nodes(id) on delete set null,
  status text not null default 'learning' check (status in ('learning', 'learned', 'set_aside')),
  started_on date not null,
  ended_on date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lessons_user on public.lessons (user_id, status);

create table if not exists public.lesson_checkins (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  kept boolean not null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, date)
);

create index if not exists lesson_checkins_user_date on public.lesson_checkins (user_id, date);

alter table public.missions enable row level security;
alter table public.focuses enable row level security;
alter table public.quests enable row level security;
alter table public.quest_camps enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_checkins enable row level security;

-- Everything is yours alone, and anything that points at a goal, quest or
-- lesson can only point at your own: the ids are guessable, so the policy
-- checks rather than trusting them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Own mission') then
    create policy "Own mission" on public.missions
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focuses' and policyname = 'Own focuses') then
    create policy "Own focuses" on public.focuses
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quests' and policyname = 'Own quests') then
    create policy "Own quests" on public.quests
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quest_camps' and policyname = 'Own quest camps') then
    create policy "Own quest camps" on public.quest_camps
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lessons' and policyname = 'Own lessons') then
    create policy "Own lessons" on public.lessons
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_checkins' and policyname = 'Own lesson check-ins') then
    create policy "Own lesson check-ins" on public.lesson_checkins
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.missions, public.focuses, public.quests, public.quest_camps, public.lessons, public.lesson_checkins from anon, public;
grant select, insert, update, delete on public.missions, public.focuses, public.quests, public.quest_camps, public.lessons, public.lesson_checkins to authenticated;

-- The footprints. Each entry counts on the day it started, in the phone's
-- zone, under every tag it carries (or its one category, for entries from
-- before tags). Sample entries don't count, and neither does anything
-- logged after the phone's today.
create or replace function public.ascent_steps(p_today date, p_days integer default 30, p_tz text default 'America/Denver')
returns table (tag text, days date[], last_day date)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with logged as (
    select t.tag, (e.started_at at time zone p_tz)::date as day
    from public.time_log_entries e
    cross join lateral unnest(
      case when coalesce(cardinality(e.tags), 0) > 0 then e.tags else array[e.category] end
    ) as t(tag)
    where e.user_id = auth.uid()
      and not coalesce(e.is_example, false)
      and e.started_at < ((p_today + 1)::timestamp at time zone p_tz)
  )
  select l.tag,
         coalesce(array_agg(distinct l.day order by l.day) filter (where l.day > p_today - least(greatest(coalesce(p_days, 30), 1), 366)), '{}'),
         max(l.day)
  from logged l
  where l.tag is not null
  group by l.tag;
$$;

revoke all on function public.ascent_steps(date, integer, text) from public, anon;
grant execute on function public.ascent_steps(date, integer, text) to authenticated;

-- His five pillars become the lifetime goals, in his words. Only the five
-- root goals with exactly these names are touched; nothing else changes.
update public.nodes n
   set title = v.new_title, updated_at = now()
  from (values ('be highly skilled', 'Highly skilled'),
               ('in tune with God', 'Highly in tune with God'),
               ('Highly Educated', 'Highly educated'),
               ('Highly Charitable', 'Highly selfless'),
               ('Highly Disciplined', 'Highly disciplined')) v(old_title, new_title)
 where n.title = v.old_title
   and not exists (select 1 from public.node_edges e where e.child_id = n.id);
