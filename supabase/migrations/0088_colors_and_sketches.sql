-- Colours on camp steps and quest lines, and sketches (Aaron, 2026-10-26).
--
-- A step or a line on a quest's list can wear a colour he picks. The app
-- keeps the palette, so a new colour needs no change here.
--
-- A sketch is drawn on a quest line (a task or a note line) or on a camp
-- step, mostly with a pencil on his iPad. It's kept as its strokes, so it
-- stays sharp at any size and can be drawn on again. "Analyze" has the
-- sketch function read it with what it's attached to and keep a summary
-- here beside it.
--
-- Additive only: two nullable columns and one new table. To undo it, remove
-- the table and the two columns in the SQL Editor; nothing else points at
-- them.

alter table public.camp_steps add column if not exists color text check (color is null or color ~ '^[a-z]{3,12}$');
alter table public.quest_tasks add column if not exists color text check (color is null or color ~ '^[a-z]{3,12}$');

create table if not exists public.sketches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- what it's drawn on: exactly one of a quest line or a camp step
  quest_task_id uuid references public.quest_tasks(id) on delete cascade,
  camp_step_id uuid references public.camp_steps(id) on delete cascade,
  -- the page it was drawn on, in its own units; strokes are in the same units
  width integer not null check (width between 50 and 10000),
  height integer not null check (height between 50 and 10000),
  -- [{ c: colour, w: width, p: [x, y, pressure 0-100, x, y, pressure, ...] }]
  strokes jsonb not null default '[]'::jsonb check (jsonb_typeof(strokes) = 'array' and octet_length(strokes::text) <= 3000000),
  title text check (title is null or length(title) <= 200),
  summary text check (summary is null or length(summary) <= 20000),
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(quest_task_id, camp_step_id) = 1)
);

create index if not exists sketches_task on public.sketches (quest_task_id, created_at) where quest_task_id is not null;
create index if not exists sketches_step on public.sketches (camp_step_id, created_at) where camp_step_id is not null;

alter table public.sketches enable row level security;

-- Yours alone, and only on your own lines and steps.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sketches' and policyname = 'Own sketches') then
    create policy "Own sketches" on public.sketches
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (quest_task_id is null or exists (select 1 from public.quest_tasks t where t.id = quest_task_id and t.user_id = auth.uid()))
        and (camp_step_id is null or exists (select 1 from public.camp_steps s where s.id = camp_step_id and s.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.sketches from anon, public;
grant select, insert, update, delete on public.sketches to authenticated;
