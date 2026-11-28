-- Arrows on a target (Aaron, 2026-11-28).
--
-- Every arrow is a good one now: he places it himself, any time, as many
-- as he likes in a day, for something he did toward that target ("I read
-- something", "I drew"). An arrow can carry a title, a note, both or
-- neither. Placing one never asks where it landed: the app spreads them
-- over the middle of the face by the arrow's own id.
--
--   target_arrows   one arrow on exactly one target: the mission, a
--                     lifetime goal (nodes), a quest, a lesson, or a week's
--                     focus (focus_goals). Dated by his own day.
--
-- The evening's shots (mark_shots) are left as they are. Purely additive:
-- one new table, its indexes and its policy. Nothing existing is changed.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop table if exists public.target_arrows;

create table if not exists public.target_arrows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Exactly one target.
  mission boolean not null default false,
  goal_id uuid references public.nodes(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  focus_goal_id uuid references public.focus_goals(id) on delete cascade,
  -- The day it was placed, in his own time zone.
  date date not null,
  title text check (title is null or char_length(btrim(title)) between 1 and 120),
  note text check (note is null or char_length(btrim(note)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_arrows_one_target check (
    num_nonnulls(nullif(mission, false), goal_id, quest_id, lesson_id, focus_goal_id) = 1
  )
);

create index if not exists target_arrows_user_date on public.target_arrows (user_id, date desc);
create index if not exists target_arrows_goal on public.target_arrows (goal_id) where goal_id is not null;
create index if not exists target_arrows_quest on public.target_arrows (quest_id) where quest_id is not null;
create index if not exists target_arrows_lesson on public.target_arrows (lesson_id) where lesson_id is not null;
create index if not exists target_arrows_focus on public.target_arrows (focus_goal_id) where focus_goal_id is not null;

alter table public.target_arrows enable row level security;

-- Your own arrows, and only on your own goal, quest, lesson and focus: the
-- ids are guessable, so the policy checks rather than trusting them (the
-- same as target_notes, 0104).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'target_arrows' and policyname = 'Own target arrows') then
    create policy "Own target arrows" on public.target_arrows
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
        and (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid() and q.lesson_id is null))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
        and (focus_goal_id is null or exists (select 1 from public.focus_goals f where f.id = focus_goal_id and f.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.target_arrows from anon, public;
grant select, insert, update, delete on public.target_arrows to authenticated;
