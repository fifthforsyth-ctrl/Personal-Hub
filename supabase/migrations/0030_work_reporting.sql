-- Reporting the work day.
--
-- Deliberately small. No projects and no billable-hours machinery: the unit is
-- the task, which already exists, and the hours are context rather than an
-- invoice. What was missing was only a way to say "this bit is work" and a
-- place to put the thing you want to tell your boss the moment it happens.

-- Which categories count as work. A flag rather than a hardcoded name, so the
-- report doesn't quietly break the day a category gets renamed.
alter table public.user_categories
  add column if not exists is_work boolean not null default false;

update public.user_categories
   set is_work = true
 where is_work = false
   and (name ilike '%parker%' or name ilike 'work%');

-- Which tasks are work. Personal and work tasks share a day and a plan; only
-- the marked ones ever reach the report.
alter table public.tasks
  add column if not exists is_work boolean not null default false;

create index if not exists tasks_work_idx on public.tasks (user_id, date, is_work) where is_work;

-- The running "tell Parker" list.
--
-- The whole point is capture at the moment, not composition at 5pm: if the
-- report is assembled from things written down as they happened, it is honest
-- and it takes no effort. If it is written from memory at the end of the day,
-- the ten o'clock thing is already gone.
create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null default 'did' check (kind in ('did', 'blocked', 'question', 'note')),
  body text not null,
  minutes integer,
  created_at timestamptz not null default now()
);

create index if not exists work_notes_day_idx on public.work_notes (user_id, date, created_at);

alter table public.work_notes enable row level security;

create policy "own work notes" on public.work_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The report as sent. Stored on the day so "what did I tell him Tuesday" has
-- an answer, and stamped only when you actually send it — a draft you looked
-- at and closed is not a report.
alter table public.day_plans
  add column if not exists work_report text,
  add column if not exists work_report_sent_at timestamptz;

-- Everything the report is built from, for one day, in one call.
-- (Full body applied to the database; see work_day there.)
