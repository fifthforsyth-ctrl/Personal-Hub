-- Notes, reflections and quotes on any target (2026-11-02).
--
-- The Targets tab puts the whole ladder in one place: the mission, the
-- lifetime goals, the quests and lessons, and the week's focus. Aaron can
-- open any of them, reflect on it or jot a note any time of day, and link a
-- quote that speaks to it.
--
--   target_notes   one note or reflection on exactly one target: the
--                    mission, a lifetime goal (nodes), a quest, a lesson, or
--                    a weekly focus (focus_goals). A reflection keeps the
--                    question it answered. Dated by his own day.
--   quote_links    one quote on exactly one target: a quote from the
--                    library (quotes) or one of his own written down
--                    (study_notes), with an optional line on why it fits.
--
-- A lesson's notes and quotes key on the lesson itself, never on its
-- mountain (a quests row with lesson_id), and the policies refuse a
-- mountain. A weekly focus keys on the week's row; the app walks
-- carried_from so earlier weeks still show, the same as focus_notes (0101).
-- Removing a target takes its notes and links with it, the same as its
-- check-ins (it has to: with exactly one target, set null would block the
-- delete). delete_goal (0056) is left as it is.
--
-- Nothing here scores anything. Purely additive: two new tables, their
-- indexes and policies, and a one-time copy of a lesson's old notes into
-- target_notes (at the end). Nothing existing is changed.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop table if exists public.quote_links;
--   drop table if exists public.target_notes;

create table if not exists public.target_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Exactly one target.
  mission boolean not null default false,
  goal_id uuid references public.nodes(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  focus_goal_id uuid references public.focus_goals(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'reflection')),
  -- The question a reflection answered, as it was asked that day.
  prompt text check (prompt is null or char_length(btrim(prompt)) between 1 and 300),
  -- The day it was written, in his own time zone.
  date date not null,
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_notes_one_target check (
    num_nonnulls(nullif(mission, false), goal_id, quest_id, lesson_id, focus_goal_id) = 1
  ),
  -- Only a reflection has a question.
  constraint target_notes_prompt check (kind = 'reflection' or prompt is null)
);

create index if not exists target_notes_user_created on public.target_notes (user_id, created_at desc);
create index if not exists target_notes_goal on public.target_notes (goal_id) where goal_id is not null;
create index if not exists target_notes_quest on public.target_notes (quest_id) where quest_id is not null;
create index if not exists target_notes_lesson on public.target_notes (lesson_id) where lesson_id is not null;
create index if not exists target_notes_focus on public.target_notes (focus_goal_id) where focus_goal_id is not null;

create table if not exists public.quote_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Exactly one quote: from the library, or one of his own.
  quote_id uuid references public.quotes(id) on delete cascade,
  note_id uuid references public.study_notes(id) on delete cascade,
  -- Exactly one target.
  mission boolean not null default false,
  goal_id uuid references public.nodes(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  focus_goal_id uuid references public.focus_goals(id) on delete cascade,
  -- Why it fits, in his words. Optional.
  why text check (why is null or char_length(btrim(why)) between 1 and 300),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint quote_links_one_quote check (num_nonnulls(quote_id, note_id) = 1),
  constraint quote_links_one_target check (
    num_nonnulls(nullif(mission, false), goal_id, quest_id, lesson_id, focus_goal_id) = 1
  )
);

-- A quote is linked to a target once. The mission has no id, so it keys on
-- the zero uuid, which no row ever has. An expression index can't be an
-- upsert target, so the app inserts and reads 23505 as "already linked".
create unique index if not exists quote_links_once on public.quote_links (
  user_id,
  coalesce(quote_id, note_id),
  coalesce(goal_id, quest_id, lesson_id, focus_goal_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index if not exists quote_links_user_created on public.quote_links (user_id, created_at desc);
create index if not exists quote_links_goal on public.quote_links (goal_id) where goal_id is not null;
create index if not exists quote_links_quest on public.quote_links (quest_id) where quest_id is not null;
create index if not exists quote_links_lesson on public.quote_links (lesson_id) where lesson_id is not null;
create index if not exists quote_links_focus on public.quote_links (focus_goal_id) where focus_goal_id is not null;
create index if not exists quote_links_quote on public.quote_links (quote_id) where quote_id is not null;
create index if not exists quote_links_note on public.quote_links (note_id) where note_id is not null;

alter table public.target_notes enable row level security;
alter table public.quote_links enable row level security;

-- Your own rows, and only on your own goal, quest, lesson, focus and quote:
-- the ids are guessable, so the policies check rather than trusting them
-- (the same as 0059 and 0101).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'target_notes' and policyname = 'Own target notes') then
    create policy "Own target notes" on public.target_notes
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
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_links' and policyname = 'Own quote links') then
    create policy "Own quote links" on public.quote_links
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (quote_id is null or exists (select 1 from public.quotes x where x.id = quote_id and x.user_id = auth.uid()))
        and (note_id is null or exists (select 1 from public.study_notes s where s.id = note_id and s.user_id = auth.uid()))
        and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
        and (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid() and q.lesson_id is null))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
        and (focus_goal_id is null or exists (select 1 from public.focus_goals f where f.id = focus_goal_id and f.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.target_notes from anon, public;
revoke all on public.quote_links from anon, public;
grant select, insert, update, delete on public.target_notes to authenticated;
grant select, insert, update, delete on public.quote_links to authenticated;

-- A lesson's old notes come along. The old Quests page kept "Notes on this
-- lesson" on the lesson's mountain (quests.note on the quests row with its
-- lesson_id), and the lesson's own page now reads only target_notes, so
-- each mountain's note is copied once onto the lesson as a note, dated the
-- day its mountain was made (in Utah, where he lives). Nothing is moved or
-- cleared: quests.note stays as it was. No mountain has a note today, so
-- this copies nothing now; it's here so nothing written there is lost if
-- one is written before this is applied. Running it again copies nothing
-- twice (a lesson that already has that note is skipped). Blank lines and
-- spaces round a note are trimmed, as the app trims a note it saves.
insert into public.target_notes (user_id, lesson_id, kind, date, text)
select q.user_id, q.lesson_id, 'note', (q.created_at at time zone 'America/Denver')::date, btrim(q.note, E' \t\r\n')
from public.quests q
where q.lesson_id is not null and btrim(coalesce(q.note, ''), E' \t\r\n') <> ''
  and not exists (select 1 from public.target_notes t where t.lesson_id = q.lesson_id and t.text = btrim(q.note, E' \t\r\n'));
