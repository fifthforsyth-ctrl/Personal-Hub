-- Resolving a section (Aaron, 2026-10-30): "let me delete old sections and
-- still have my app keep my buildings from previous completed tasks." A
-- section he has finished can go, so it stops taking room in the camp, but
-- what he finished in it is remembered: its bricks stay in the village, and
-- the camp still counts them as done.
--
--   resolved_steps          one row for each finished step of a section he
--                           resolved, kept as it was when it went: its own
--                           id, its camp and quest, the section's name, its
--                           words, the day it was done, and `done_at` (the
--                           step's updated_at then), so its bricks keep
--                           their place in the order they were laid.
--                           `counted` is false for a clipboard column's
--                           (0095), which never counted toward the camp.
--   resolve_section(id, d)  keeps the section's finished steps (and
--                           sub-steps) there, then removes the section with
--                           everything in it, in one statement; `d` is the
--                           phone's day. Returns how many it kept.
--
-- Rows are written only by resolve_section (it runs as its owner, and
-- checks the section is the caller's); he can read his own.
--
-- Additive only: one table and one function. To undo it, drop the function
-- and the table in the SQL Editor (the sections resolved meanwhile stay gone).

create table if not exists public.resolved_steps (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  camp_id uuid references public.quest_camps(id) on delete set null,
  quest_id uuid references public.quests(id) on delete set null,
  section_id uuid not null,
  section_title text not null,
  parent_id uuid,
  text text not null,
  note text,
  done_on date not null,
  done_at timestamptz,
  counted boolean not null default true,
  position integer not null default 0,
  resolved_on date not null,
  resolved_at timestamptz not null default now()
);

create index if not exists resolved_steps_user on public.resolved_steps (user_id, camp_id);

alter table public.resolved_steps enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resolved_steps' and policyname = 'Own resolved steps') then
    create policy "Own resolved steps" on public.resolved_steps
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.resolved_steps from anon, public, authenticated;
grant select on public.resolved_steps to authenticated;

create or replace function public.resolve_section(p_section uuid, p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sec record;
  n integer;
begin
  if me is null or p_today is null then
    raise exception 'resolve_section needs a signed-in user and the day';
  end if;
  select s.id, s.title, s.camp_id, s.clipboard, c.quest_id into sec
  from public.camp_sections s
  join public.quest_camps c on c.id = s.camp_id
  where s.id = p_section and s.user_id = me;
  if not found then
    raise exception 'That section is gone' using errcode = 'P0002';
  end if;

  with recursive tree(id) as (
    select st.id from public.camp_steps st where st.section_id = sec.id and st.user_id = me
    union
    select k.id from public.camp_steps k join tree t on k.parent_id = t.id where k.user_id = me
  )
  insert into public.resolved_steps (id, user_id, camp_id, quest_id, section_id, section_title, parent_id, text, note, done_on, done_at, counted, position, resolved_on)
  select st.id, me, st.camp_id, sec.quest_id, sec.id, sec.title, st.parent_id, st.text, st.note, st.done_on, st.updated_at, not sec.clipboard, st.position, p_today
  from public.camp_steps st
  where st.id in (select id from tree) and st.done_on is not null and st.kind = 'task'
  on conflict (id) do nothing;
  get diagnostics n = row_count;

  -- its steps, their sub-steps, sketches and photos go with it
  delete from public.camp_sections where id = sec.id and user_id = me;
  return n;
end
$$;

revoke all on function public.resolve_section(uuid, date) from public, anon;
grant execute on function public.resolve_section(uuid, date) to authenticated;
