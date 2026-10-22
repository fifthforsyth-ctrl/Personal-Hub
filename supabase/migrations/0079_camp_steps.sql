-- Steps under each camp, plans that fill them, and a mountain for a lesson.
--
-- Aaron, 2026-10-22: the plugin quest's camps are its tabs (Sift, Multicam,
-- Graphica, Reframe, Motion), and each tab runs the same long playbook. So a
-- camp now holds steps, grouped into sections the way a plan groups them,
-- each with a note, and a camp has notes of its own. A plan he uploads is
-- read once into sections and steps and kept, so it can fill any number of
-- camps; what it says that isn't a step (who to check in with, what makes a
-- good plugin) is kept with it to read beside the work.
--
--   quest_camps.note  notes on the camp as a whole
--   quests.lesson_id  set when the quest is a lesson's own mountain: its
--                     camps and steps work the same, and it shows with the
--                     lesson rather than as a quest of its own
--   quest_plans       a plan as read: its title, summary, the sections and
--                     steps as a template, and the rest as notes
--   camp_sections     a camp's groups of steps, in order: a plan's phases,
--                     or ones he adds. plan_id is where it came from
--   camp_steps        one step: its words, a note, the phone's day it was
--                     done (null while it's open), in order within its
--                     section. A step with no section sits at the camp's top
--
-- Additive only: two new columns, three new tables, and the quests policy
-- widened to check the lesson it points at. To undo it, remove the three
-- tables and the two columns in the SQL Editor, and put the "Own quests"
-- check back to its 0074 form.

alter table public.quest_camps add column if not exists note text check (note is null or length(note) <= 4000);

alter table public.quests add column if not exists lesson_id uuid references public.lessons(id) on delete cascade;
-- One mountain per lesson.
create unique index if not exists quests_lesson on public.quests (lesson_id) where lesson_id is not null;

-- A quest can only be a mountain for your own lesson.
alter policy "Own quests" on public.quests
  with check (
    user_id = auth.uid()
    and (goal_id is null or exists (select 1 from public.nodes n where n.id = goal_id and n.user_id = auth.uid()))
    and (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid()))
  );

create table if not exists public.quest_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text check (summary is null or length(summary) <= 2000),
  -- Everything in the plan that isn't a step, in its own words.
  notes text check (notes is null or length(notes) <= 20000),
  -- [{ title, why, note, steps: [{ text, note }] }], in order.
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  -- The file it came from, if it came from one.
  source text check (source is null or length(source) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists quest_plans_user on public.quest_plans (user_id, created_at);

create table if not exists public.camp_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  camp_id uuid not null references public.quest_camps(id) on delete cascade,
  plan_id uuid references public.quest_plans(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  why text check (why is null or length(why) <= 1000),
  note text check (note is null or length(note) <= 4000),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists camp_sections_camp on public.camp_sections (camp_id, position);
create index if not exists camp_sections_user on public.camp_sections (user_id);
create index if not exists camp_sections_plan on public.camp_sections (plan_id) where plan_id is not null;

create table if not exists public.camp_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  camp_id uuid not null references public.quest_camps(id) on delete cascade,
  section_id uuid references public.camp_sections(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 1000),
  note text check (note is null or length(note) <= 4000),
  -- The phone's day it was done. Null while it's still to do.
  done_on date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists camp_steps_camp on public.camp_steps (camp_id, position);
create index if not exists camp_steps_section on public.camp_steps (section_id) where section_id is not null;
create index if not exists camp_steps_user on public.camp_steps (user_id);

alter table public.quest_plans enable row level security;
alter table public.camp_sections enable row level security;
alter table public.camp_steps enable row level security;

-- Yours alone, and what a row points at must be yours too: a section's camp
-- and plan, a step's camp and section (which must be in the same camp).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quest_plans' and policyname = 'Own plans') then
    create policy "Own plans" on public.quest_plans
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'camp_sections' and policyname = 'Own camp sections') then
    create policy "Own camp sections" on public.camp_sections
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quest_camps c where c.id = camp_id and c.user_id = auth.uid())
        and (plan_id is null or exists (select 1 from public.quest_plans p where p.id = plan_id and p.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'camp_steps' and policyname = 'Own camp steps') then
    create policy "Own camp steps" on public.camp_steps
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quest_camps c where c.id = camp_id and c.user_id = auth.uid())
        and (section_id is null or exists (
          select 1 from public.camp_sections s where s.id = section_id and s.user_id = auth.uid() and s.camp_id = camp_steps.camp_id
        ))
      );
  end if;
end
$$;

revoke all on public.quest_plans, public.camp_sections, public.camp_steps from anon, public;
grant select, insert, update, delete on public.quest_plans, public.camp_sections, public.camp_steps to authenticated;
