-- Today on Quests as a board (Aaron, 2026-10-28): he orders what's on a
-- quest's Today himself, sees it by camp or by computer, and filters it by
-- urgency or colour. He has more than one computer (and chat) working on the
-- same quest, so a step, a whole section or a line can be handed to one of
-- them: the top one in a computer's column is what it's working on, the next
-- is on deck.
--
--   camp_steps.computer, camp_sections.computer, quest_tasks.computer
--                    which of the quest's computers it's handed to (the `n`
--                    of one in quests.computers), null when it's no one's.
--                    It stays when the day ends, so a task picked again
--                    another day goes back to the same computer
--   quest_tasks.urgency
--                    how urgent a line is, the same marks a step has (0084)
--   quests.computers the quest's computers, in order: [{ "n": 1, "name":
--                    "Computer 1" }, ...]. Null means the two it starts with
--   quest_today      the order he put a quest's Today in, one row per quest
--                    per day: `keys` names each thing on it ("step:<id>",
--                    "sec:<id>", "line:<id>"). Only today's row is read, so
--                    each day's order starts fresh and nothing carries
--                    forward (Aaron, 2026-10-14)
--
-- Additive only: five columns and one new table. To undo it, remove the
-- table and the columns in the SQL Editor; nothing else points at them.

alter table public.camp_steps add column if not exists computer smallint check (computer is null or computer between 1 and 99);
alter table public.camp_sections add column if not exists computer smallint check (computer is null or computer between 1 and 99);
alter table public.quest_tasks add column if not exists computer smallint check (computer is null or computer between 1 and 99);
alter table public.quest_tasks add column if not exists urgency text check (urgency is null or urgency in ('red', 'yellow', 'green'));
alter table public.quests add column if not exists computers jsonb check (computers is null or (jsonb_typeof(computers) = 'array' and jsonb_array_length(computers) <= 12));

create table if not exists public.quest_today (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  day date not null,
  keys text[] not null default '{}' check (cardinality(keys) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (quest_id, day)
);

create index if not exists quest_today_user on public.quest_today (user_id, day);

alter table public.quest_today enable row level security;

-- Yours alone, on a quest that's yours.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quest_today' and policyname = 'Own quest today') then
    create policy "Own quest today" on public.quest_today
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.quest_today from anon, public;
grant select, insert, update, delete on public.quest_today to authenticated;
