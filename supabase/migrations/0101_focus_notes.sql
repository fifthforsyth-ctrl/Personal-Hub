-- Notes on a weekly focus, written any time.
--
-- A focus is something you carry through the whole week, and what you
-- notice about it doesn't wait for the evening: what helped, what got in
-- the way, a line from a talk that fits it. So each focus goal gets its own
-- running notes, each one dated by the day you wrote it.
--
-- A note belongs to the week's goal row. When Sunday's review keeps a goal,
-- the new week's row points back at the old one (focus_goals.carried_from),
-- and the app walks that chain so the notes from earlier weeks of the same
-- focus still show under it. Removing a goal takes its notes with it, the
-- same as its check-ins.
--
--   focus_notes   one row per note: which goal, the day, the words
--
-- Nothing here scores anything.
--
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop table if exists public.focus_notes;

create table if not exists public.focus_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.focus_goals(id) on delete cascade,
  -- The day you wrote it, in your own time zone, like a check-in's date.
  date date not null,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists focus_notes_user_goal_created on public.focus_notes (user_id, goal_id, created_at desc);

alter table public.focus_notes enable row level security;

-- Your own notes, and only on your own goal: the ids are guessable, so the
-- policy checks rather than trusting them (the same as 0059's check-ins).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_notes' and policyname = 'Own focus notes') then
    create policy "Own focus notes" on public.focus_notes
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.focus_goals g where g.id = goal_id and g.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.focus_notes from anon, public;
grant select, insert, update, delete on public.focus_notes to authenticated;
