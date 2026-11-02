-- Evening checks, placed arrows on the week's focus, and 1–10 feelings
-- (2026-11-02).
--
-- Three things change about the evening.
--
-- 1. What a bullseye takes becomes a list of checks, and a check can be
--    answered more ways than Yes, Some or No: Yes/No, Yes/Some/No, 1 to 10,
--    a number, minutes, a time, one of a few choices, or a few words. Each
--    says what passes ("7 or more", "by 4:35"), and the share of checks
--    passed puts the arrow in its ring, the way the share of Yes did. A
--    check can be reflection only: asked every evening, never scored. The
--    existing aims become Yes/No checks (Aaron's call, 2026-11-02).
--
--      mark_aims      + kind, options, pass, unit, auto, counts
--
-- 2. Each weekly focus lands an arrow each day, one of two ways, chosen per
--    focus: he places it himself on a small target ("Win by win" needs his
--    judgment), or it lands by its own checks ("Up by 4:35" doesn't). A
--    focus can also count toward one lifetime goal, quest or lesson, so the
--    arrow it lands that evening counts in that bigger target's shot.
--
--      focus_goals    + lands_by, quest_id, lesson_id (the lifetime goal
--                       link is the existing node_id)
--      focus_checks   a focus's checks, the same shape as mark_aims. Copied
--                       to the new week's row when Sunday's review keeps it
--      focus_checkins + level, spot_x, spot_y, note, answers, lands,
--                       updated_at. `moved` stays, written as level < 5, so
--                       everything that reads it keeps working
--
-- 3. Mood and stress go from 1–5 to 1–10, each with a note, and the evening
--    gets one note for any communication with God. The 1–5 columns keep
--    being written (half the 1–10, rounded up) so every chart and reader of
--    them still works. The notes live on the journal entry, so the banked
--    day's synopsis sees them with the rest of the reflection.
--
--      day_plans        + mood_10, stress_10
--      journal_entries  + god_note, mood_note, stress_note
--
-- Purely additive: new columns with defaults, one new table, new
-- constraints that every existing row already meets, and new policies.
-- Nothing existing is dropped or changed.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop policy if exists "Own focus links" on public.focus_goals;
--   drop policy if exists "Own focus links (update)" on public.focus_goals;
--   drop table if exists public.focus_checks;
--   alter table public.mark_aims drop column if exists kind, drop column if exists options,
--     drop column if exists pass, drop column if exists unit, drop column if exists auto,
--     drop column if exists counts;
--   alter table public.focus_goals drop constraint if exists focus_goals_one_link,
--     drop column if exists lands_by, drop column if exists quest_id, drop column if exists lesson_id;
--   alter table public.focus_checkins drop column if exists level, drop column if exists spot_x,
--     drop column if exists spot_y, drop column if exists note, drop column if exists answers,
--     drop column if exists lands, drop column if exists updated_at;
--   alter table public.day_plans drop column if exists mood_10, drop column if exists stress_10;
--   alter table public.journal_entries drop column if exists god_note,
--     drop column if exists mood_note, drop column if exists stress_note;

-- --- 1. Checks on a target ----------------------------------------------------

alter table public.mark_aims
  -- yn, ysn (Yes/Some/No), scale (1–10), number, minutes, time (HH:MM),
  -- choice (one of `options`), note (a few words).
  add column if not exists kind text not null default 'yn',
  -- The choices, for a choice check.
  add column if not exists options text[] not null default '{}',
  -- What passes, by kind: {"on":"yes"|"no"} for yn and ysn, {"min":7} for
  -- scale, {"min":n} or {"max":n} for number, {"min":n} for minutes,
  -- {"by":"HH:MM"} for time, {"on":[...]} for choice, {"words":true} for a
  -- note that counts. The app reads it; the database only keeps it an object.
  add column if not exists pass jsonb not null default '{}',
  -- "pages", "glasses": what a number counts.
  add column if not exists unit text,
  -- Answered for you where it can be: 'wake' fills a time check with when
  -- you got up. (A check with a focus is answered by the time log, as before.)
  add column if not exists auto text,
  -- False: reflection only, asked but never scored.
  add column if not exists counts boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mark_aims_kind') then
    alter table public.mark_aims add constraint mark_aims_kind
      check (kind in ('yn', 'ysn', 'scale', 'number', 'minutes', 'time', 'choice', 'note'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mark_aims_options') then
    alter table public.mark_aims add constraint mark_aims_options
      check (cardinality(options) <= 8 and array_position(options, null) is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mark_aims_pass') then
    alter table public.mark_aims add constraint mark_aims_pass check (jsonb_typeof(pass) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mark_aims_unit') then
    alter table public.mark_aims add constraint mark_aims_unit check (unit is null or length(unit) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mark_aims_auto') then
    alter table public.mark_aims add constraint mark_aims_auto check (auto is null or auto in ('wake'));
  end if;
end
$$;

-- --- 2. Arrows on the week's focus --------------------------------------------

alter table public.focus_goals
  -- 'placed': he puts the arrow where the day landed. 'checks': its checks do.
  add column if not exists lands_by text not null default 'placed',
  -- What its arrows count toward, besides the lifetime goal in node_id.
  add column if not exists quest_id uuid references public.quests(id) on delete set null,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'focus_goals_lands_by') then
    alter table public.focus_goals add constraint focus_goals_lands_by check (lands_by in ('placed', 'checks'));
  end if;
  -- One bigger target at most: a lifetime goal, a quest or a lesson.
  if not exists (select 1 from pg_constraint where conname = 'focus_goals_one_link') then
    alter table public.focus_goals add constraint focus_goals_one_link check (num_nonnulls(node_id, quest_id, lesson_id) <= 1);
  end if;
end
$$;

-- The existing policy checks node_id is yours. These check the quest and
-- the lesson too: restrictive, so they add to it rather than widen it (the
-- ids are guessable).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_goals' and policyname = 'Own focus links') then
    create policy "Own focus links" on public.focus_goals
      as restrictive
      for insert to authenticated
      with check (
        (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_goals' and policyname = 'Own focus links (update)') then
    create policy "Own focus links (update)" on public.focus_goals
      as restrictive
      for update to authenticated
      using (true)
      with check (
        (quest_id is null or exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()))
        and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
      );
  end if;
end
$$;

create table if not exists public.focus_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.focus_goals(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 120),
  kind text not null default 'yn'
    check (kind in ('yn', 'ysn', 'scale', 'number', 'minutes', 'time', 'choice', 'note')),
  options text[] not null default '{}' check (cardinality(options) <= 8 and array_position(options, null) is null),
  pass jsonb not null default '{}' check (jsonb_typeof(pass) = 'object'),
  unit text check (unit is null or length(unit) <= 20),
  auto text check (auto is null or auto in ('wake')),
  counts boolean not null default true,
  -- Answered by the time log on a day one of this lifetime focus's
  -- categories was logged, the same as an aim's.
  focus_id uuid references public.focuses(id) on delete set null,
  position integer not null default 0,
  retired_on date,
  created_at timestamptz not null default now()
);

create index if not exists focus_checks_goal on public.focus_checks (goal_id, position);
create index if not exists focus_checks_user on public.focus_checks (user_id);

alter table public.focus_checks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_checks' and policyname = 'Own focus checks') then
    create policy "Own focus checks" on public.focus_checks
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.focus_goals g where g.id = goal_id and g.user_id = auth.uid())
        and (focus_id is null or exists (select 1 from public.focuses f where f.id = focus_id and f.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.focus_checks from anon, public;
grant select, insert, update, delete on public.focus_checks to authenticated;

alter table public.focus_checkins
  -- 0 bullseye … 5 missed, as on the Mark. Null on a row written before this.
  add column if not exists level smallint,
  -- Where the arrow sits, in target units (the face is 80 from the center,
  -- the miss band runs to 96). Null when it landed by checks: the app then
  -- gives it a steady spot in its ring.
  add column if not exists spot_x real,
  add column if not exists spot_y real,
  add column if not exists note text,
  -- The checks' answers when it landed by them, the same shape as a shot's.
  add column if not exists answers jsonb not null default '[]',
  add column if not exists lands text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'focus_checkins_level') then
    alter table public.focus_checkins add constraint focus_checkins_level check (level is null or level between 0 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_checkins_spot') then
    alter table public.focus_checkins add constraint focus_checkins_spot check (
      (spot_x is null) = (spot_y is null)
      and (spot_x is null or spot_x * spot_x + spot_y * spot_y <= 97 * 97)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_checkins_note') then
    alter table public.focus_checkins add constraint focus_checkins_note check (note is null or length(note) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_checkins_answers') then
    alter table public.focus_checkins add constraint focus_checkins_answers check (jsonb_typeof(answers) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_checkins_lands') then
    alter table public.focus_checkins add constraint focus_checkins_lands check (lands is null or lands in ('placed', 'checks'));
  end if;
end
$$;

-- --- 3. Feelings on 1–10, and a note for God ----------------------------------

alter table public.day_plans
  add column if not exists mood_10 smallint,
  add column if not exists stress_10 smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'day_plans_mood_10') then
    alter table public.day_plans add constraint day_plans_mood_10 check (mood_10 is null or mood_10 between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'day_plans_stress_10') then
    alter table public.day_plans add constraint day_plans_stress_10 check (stress_10 is null or stress_10 between 1 and 10);
  end if;
end
$$;

alter table public.journal_entries
  -- "Any communication with God today?" in his words.
  add column if not exists god_note text,
  add column if not exists mood_note text,
  add column if not exists stress_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_god_note') then
    alter table public.journal_entries add constraint journal_entries_god_note check (god_note is null or length(god_note) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_mood_note') then
    alter table public.journal_entries add constraint journal_entries_mood_note check (mood_note is null or length(mood_note) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_stress_note') then
    alter table public.journal_entries add constraint journal_entries_stress_note check (stress_note is null or length(stress_note) <= 500);
  end if;
end
$$;
