-- The Mark: every goal is a target (2026-10-20).
--
-- In scripture the words translated as sin, chata and hamartia, both mean to
-- miss the mark. So each lifetime goal, the quest and each lesson is a
-- target. In the evening reflection Aaron answers what a bullseye takes for
-- each, Yes, Some or No, with a line if he wants; when he banks the day the
-- arrows fly, and where each lands comes from his answers, never from aiming.
--
--   mark_targets   one per lifetime goal, quest or lesson that has been
--                  shot at or set up: the four reasons a shot misses, which
--                  name the target's four sections
--   mark_aims      what a bullseye takes, in his words: two to four plain
--                  things. One can point at a focus, so the time log answers
--                  it when the focus was logged that day. A retired aim
--                  stops being asked; old shots keep their answers
--   mark_shots     one per target per day: the answers, the ring they put the
--                  arrow in (0 bullseye … 5 missed), the section it missed
--                  toward (read from his line, picked by him, or guessed),
--                  and the line itself
--
-- Additive: nothing existing changes.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop table if exists public.mark_shots, public.mark_aims, public.mark_targets;

create table if not exists public.mark_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Exactly one of these: what the target is.
  goal_id uuid references public.nodes(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  -- The four reasons a shot misses, clockwise from the top right.
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint mark_targets_one check (num_nonnulls(goal_id, quest_id, lesson_id) = 1),
  constraint mark_targets_reasons check (cardinality(reasons) <= 4 and array_position(reasons, null) is null)
);

create unique index if not exists mark_targets_goal on public.mark_targets (goal_id) where goal_id is not null;
create unique index if not exists mark_targets_quest on public.mark_targets (quest_id) where quest_id is not null;
create unique index if not exists mark_targets_lesson on public.mark_targets (lesson_id) where lesson_id is not null;
create index if not exists mark_targets_user on public.mark_targets (user_id);

create table if not exists public.mark_aims (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.mark_targets(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 120),
  -- Answered by the time log: Yes on a day one of the focus's categories
  -- was logged.
  focus_id uuid references public.focuses(id) on delete set null,
  position integer not null default 0,
  -- The phone's day it stopped being asked. Null while it's asked.
  retired_on date,
  created_at timestamptz not null default now()
);

create index if not exists mark_aims_target on public.mark_aims (target_id, position);
create index if not exists mark_aims_user on public.mark_aims (user_id);

create table if not exists public.mark_shots (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.mark_targets(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The phone's day the shot is for.
  date date not null,
  -- [{ "aim": uuid, "text": "Exercised", "v": 2 }], v: 2 yes, 1 some, 0 no.
  -- The text is kept so a reworded or retired aim still reads as it was.
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  -- 0 bullseye, 1 inner, 2 middle, 3 outer, 4 edge, 5 missed.
  level smallint not null check (level between 0 and 5),
  -- The section a miss went toward (an index into the target's reasons),
  -- and how it got there. A bullseye has none.
  reason smallint check (reason between 0 and 3),
  reason_how text check (reason_how in ('read', 'yours', 'guess')),
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_id, date)
);

create index if not exists mark_shots_user_date on public.mark_shots (user_id, date);

alter table public.mark_targets enable row level security;
alter table public.mark_aims enable row level security;
alter table public.mark_shots enable row level security;

-- Yours alone, and anything that points at a goal, quest, lesson, focus or
-- target can only point at your own: the ids are guessable, so the policy
-- checks rather than trusting them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mark_targets' and policyname = 'Own targets') then
    create policy "Own targets" on public.mark_targets
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
        and (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mark_aims' and policyname = 'Own aims') then
    create policy "Own aims" on public.mark_aims
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.mark_targets t where t.id = target_id and t.user_id = auth.uid())
        and (focus_id is null or exists (select 1 from public.focuses f where f.id = focus_id and f.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mark_shots' and policyname = 'Own shots') then
    create policy "Own shots" on public.mark_shots
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.mark_targets t where t.id = target_id and t.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.mark_targets, public.mark_aims, public.mark_shots from anon, public;
grant select, insert, update, delete on public.mark_targets, public.mark_aims, public.mark_shots to authenticated;
