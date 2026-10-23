-- Quest to-do lists, and village builds he chooses.
--
-- Aaron, 2026-10-23: he works his quests fluidly, putting in new to-do lists
-- for a quest day after day, ticking them off and writing notes on what he
-- did, then jumping to another quest and doing the same. So each quest (and
-- each lesson, through its own mountain) now keeps a running list: tasks,
-- sub-tasks under them, note lines, and a note on every one.
--
-- The village stops being one build per quest sized to its steps. He chooses
-- what to build from a catalog (a sword armory, a chapel, a fortress...), and
-- every task or camp step he finishes, from any quest or lesson, lays the
-- next bricks on it until it stands. Then he chooses the next. Which bricks
-- went where is worked out from the tasks themselves in order, so only the
-- choice is kept here.
--
--   quest_tasks       one line on a quest's list
--     parent_id       the task it sits under, for a sub-task
--     kind            'task' (it can be ticked) or 'note' (a line of notes)
--     text, note      the line, and his notes on it
--     day             the phone's day it went on the list. Lists stay on
--                     their day; nothing is carried forward
--     done_on         the phone's day it was ticked, null while open
--     done_at         when it was ticked, to keep the order of bricks
--   village_projects  one build he chose
--     kind, seed      which build and which variation of it
--     plot            the plot it stands on, in the order plots are handed
--                     out around the plaza (0 is the first)
--     need            how many finished tasks it takes to stand
--     started_on      the phone's day he chose it; bricks land from then
--
-- His one build from 0080 (a windmill for the plugin quest) is copied in as
-- his first project, so nothing he chose is lost. village_builds stays as it
-- is but nothing reads it any more.
--
-- Additive only: two new tables and one copied row. To undo it, remove the
-- two tables in the SQL Editor; nothing else points at them.

create table if not exists public.quest_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  parent_id uuid references public.quest_tasks(id) on delete cascade,
  kind text not null default 'task' check (kind in ('task', 'note')),
  text text not null check (length(btrim(text)) between 1 and 2000),
  note text check (note is null or length(note) <= 20000),
  day date not null,
  done_on date,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a note line is never ticked
  check (kind = 'task' or done_on is null)
);

create index if not exists quest_tasks_quest on public.quest_tasks (quest_id, day, position);
create index if not exists quest_tasks_parent on public.quest_tasks (parent_id) where parent_id is not null;
create index if not exists quest_tasks_done on public.quest_tasks (user_id, done_on) where done_on is not null;

create table if not exists public.village_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- the app keeps the catalog, so new kinds of build need no change here
  kind text not null check (kind ~ '^[a-z]{2,24}$'),
  seed integer not null default 1,
  plot integer not null check (plot >= 0),
  need integer not null check (need between 1 and 1000),
  started_on date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists village_projects_plot on public.village_projects (user_id, plot);
create index if not exists village_projects_user on public.village_projects (user_id, started_on, created_at);

alter table public.quest_tasks enable row level security;
alter table public.village_projects enable row level security;

-- Yours alone. A task's quest must be yours, and a sub-task's parent must be
-- yours and on the same quest.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quest_tasks' and policyname = 'Own quest tasks') then
    create policy "Own quest tasks" on public.quest_tasks
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid())
        and (parent_id is null or exists (select 1 from public.quest_tasks p where p.id = parent_id and p.user_id = auth.uid() and p.quest_id = quest_tasks.quest_id))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'village_projects' and policyname = 'Own village projects') then
    create policy "Own village projects" on public.village_projects
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.quest_tasks from anon, public;
revoke all on public.village_projects from anon, public;
grant select, insert, update, delete on public.quest_tasks to authenticated;
grant select, insert, update, delete on public.village_projects to authenticated;

-- His windmill from 0080 becomes his first project: a windmill takes 45
-- tasks, started on the day he chose it (in Utah, where he lives).
insert into public.village_projects (user_id, kind, seed, plot, need, started_on, created_at)
select b.user_id, b.kind, b.seed, b.plot,
  case b.kind
    when 'well' then 12 when 'cottage' then 20 when 'forge' then 20 when 'watchtower' then 18
    when 'windmill' then 45 when 'farm' then 40 when 'outpost' then 35
    when 'fortress' then 150 when 'warcamp' then 120 when 'farmstead' then 100
    else 40 end,
  (b.created_at at time zone 'America/Denver')::date, b.created_at
from public.village_builds b
where not exists (select 1 from public.village_projects p where p.user_id = b.user_id and p.plot = b.plot);
