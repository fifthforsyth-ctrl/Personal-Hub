-- The evening as journal entries (Aaron, 2026-11-28).
--
-- "Allow me to choose from any of my targets to write about. I don't have
-- to do any or all of them. I can choose between those, a 'choose for me'
-- that generates questions, or an 'I pick' and I can just keep adding
-- journal entries. I can do as much or as little as I want. Then I am done
-- and I can bank the day."
--
--   evening_entries   one thing he wrote in an evening: about one of his
--                       targets (kind 'target'), answering a question the
--                       Hub chose for him ('ask'), or on his own ('free').
--                       As many in a day as he likes, in the order written.
--
-- A target entry keeps the target's name as it read that night (topic), and
-- its link survives the target being deleted (set null), so a journal never
-- loses words because a goal was tidied away.
--
-- Writing about a target also places an arrow on it (target_arrows, 0112),
-- the entry's words as the arrow's note; arrow_id remembers which, so an
-- edit changes that arrow and removing the entry removes it.
--
-- day_archive also returns the day's entries (evening_entries), so the
-- banked card and the day's summary read them. Otherwise purely additive:
-- one new table, its indexes and its policy, and day_archive rewritten with
-- one more key (create or replace; everything it returned before is the same).
--
-- Rollback (SQL Editor): re-run day_archive from before this file (pg_get_functiondef
-- saved in the PR), then: drop table if exists public.evening_entries;

create table if not exists public.evening_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The evening it belongs to, in his own day (before 4 am, yesterday's).
  date date not null,
  kind text not null check (kind in ('target', 'ask', 'free')),
  -- At most one target, only for kind 'target'.
  mission boolean not null default false,
  goal_id uuid references public.nodes(id) on delete set null,
  quest_id uuid references public.quests(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  focus_goal_id uuid references public.focus_goals(id) on delete set null,
  -- What the entry is about, as shown that night: the target's name,
  -- "Chosen for you", or his own heading.
  topic text check (topic is null or char_length(btrim(topic)) between 1 and 200),
  -- The question it answered, when there was one.
  prompt text check (prompt is null or char_length(btrim(prompt)) between 1 and 600),
  text text not null check (char_length(btrim(text)) between 1 and 8000),
  -- Writing about a target places an arrow on it (Aaron, 2026-11-28), with
  -- the entry as its note: the arrow this entry placed.
  arrow_id uuid references public.target_arrows(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evening_entries_one_target check (
    num_nonnulls(nullif(mission, false), goal_id, quest_id, lesson_id, focus_goal_id) <= 1
  ),
  constraint evening_entries_target_kind check (
    kind = 'target' or num_nonnulls(nullif(mission, false), goal_id, quest_id, lesson_id, focus_goal_id) = 0
  )
);

create index if not exists evening_entries_user_date on public.evening_entries (user_id, date desc, position);

alter table public.evening_entries enable row level security;

-- Your own entries, and only about your own goal, quest, lesson and focus
-- (the ids are guessable, so the policy checks, as target_arrows does).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'evening_entries' and policyname = 'Own evening entries') then
    create policy "Own evening entries" on public.evening_entries
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
        and (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
        and (focus_goal_id is null or exists (select 1 from public.focus_goals f where f.id = focus_goal_id and f.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.evening_entries from anon, public;
grant select, insert, update, delete on public.evening_entries to authenticated;

-- The day's record, now with the evening's entries.
create or replace function public.day_archive(p_date date, p_tz text default 'UTC')
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'date', p_date,
    'journal', (select to_jsonb(j) from public.journal_entries j where j.user_id = auth.uid() and j.date = p_date),
    'evening_entries', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'topic', e.topic, 'prompt', e.prompt, 'text', e.text,
                                          'arrow_id', e.arrow_id, 'mission', e.mission, 'goal_id', e.goal_id, 'quest_id', e.quest_id,
                                          'lesson_id', e.lesson_id, 'focus_goal_id', e.focus_goal_id)
                       order by e.position, e.created_at)
      from public.evening_entries e where e.user_id = auth.uid() and e.date = p_date
    ), '[]'::jsonb),
    'energy_tag', (select energy_tag from public.day_plans where user_id = auth.uid() and date = p_date),
    'time_entries', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.started_at)
      from public.time_log_entries t
      where t.user_id = auth.uid()
        and t.started_at >= (p_date::timestamp at time zone p_tz)
        and t.started_at < ((p_date + 1)::timestamp at time zone p_tz)
    ), '[]'::jsonb),
    'time_by_category', coalesce((
      select jsonb_agg(x order by x.minutes desc) from (
        select coalesce(nullif(tag, ''), t.category) as category,
               sum(coalesce(t.duration_minutes, 0))::numeric as minutes
        from public.time_log_entries t
        left join lateral unnest(
          case when array_length(t.tags, 1) is null then array[t.category] else t.tags end
        ) as tag on true
        where t.user_id = auth.uid()
          and t.started_at >= (p_date::timestamp at time zone p_tz)
          and t.started_at < ((p_date + 1)::timestamp at time zone p_tz)
        group by 1
      ) x
    ), '[]'::jsonb),
    'chunks', coalesce((select jsonb_agg(to_jsonb(c) order by c.start_time) from public.time_chunks c
                        where c.user_id = auth.uid() and c.date = p_date), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.tasks t
                       where t.user_id = auth.uid() and t.date = p_date), '[]'::jsonb),
    'wins_losses', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.occurred_at) from public.win_losses w
      where w.user_id = auth.uid()
        and w.occurred_at >= (p_date::timestamp at time zone p_tz)
        and w.occurred_at < ((p_date + 1)::timestamp at time zone p_tz)
    ), '[]'::jsonb),
    'prayers', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.prayed_at) from public.prayer_logs p
      where p.user_id = auth.uid()
        and p.prayed_at >= (p_date::timestamp at time zone p_tz)
        and p.prayed_at < ((p_date + 1)::timestamp at time zone p_tz)
    ), '[]'::jsonb),
    'experiences', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.occurred_at) from public.spiritual_experiences e
      where e.user_id = auth.uid()
        and e.occurred_at >= (p_date::timestamp at time zone p_tz)
        and e.occurred_at < ((p_date + 1)::timestamp at time zone p_tz)
    ), '[]'::jsonb),
    'study_notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'source_ref', s.source_ref,
                                          'ai_theme', s.ai_theme, 'ai_summary', s.ai_summary))
      from public.study_notes s where s.user_id = auth.uid() and s.studied_on = p_date
    ), '[]'::jsonb)
  );
$function$;
