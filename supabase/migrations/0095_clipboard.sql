-- The clipboard (Aaron, 2026-10-30): "this quest page is all about
-- gathering and organizing tasks". In a meeting he jots down a hundred
-- thoughts at once, about all sorts of things, and sorts them later. The
-- clipboard is where they land: columns he makes in a moment, each in one
-- of the quest's camps (Sift's thoughts stay apart from Multicam's), and
-- from there he drags them, one or many at a time, into the sections he
-- organizes. What's on it is the same as any step: it ticks, takes notes and
-- sketches, and can be made a note.
--
--   camp_sections.clipboard   a column on the clipboard, not a section of
--                             the camp's plan (it isn't counted in how far
--                             along the camp is)
--   camp_steps.kind           'task' (it can be ticked) or 'note' (a line of
--                             notes, as a quest's lines have had since 0081)
--   camp_steps_place(rows)    many steps moved at once, in one statement:
--                             into another section or camp, under another
--                             step, into a new order. Each row is
--                             { id, camp_id?, section_id?, parent_id?,
--                             position?, today_on? }; a key left out keeps
--                             what's there, a key given as null clears it.
--                             It runs as the caller, so Row Level Security
--                             holds for every row it writes.
--
-- Additive only: two columns with defaults and one function. To undo it,
-- drop the function and the two columns in the SQL Editor.

alter table public.camp_sections add column if not exists clipboard boolean not null default false;

alter table public.camp_steps add column if not exists kind text not null default 'task';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'camp_steps_kind_check') then
    alter table public.camp_steps add constraint camp_steps_kind_check check (kind in ('task', 'note'));
  end if;
end
$$;

create or replace function public.camp_steps_place(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'camp_steps_place takes a list of at most 2000 rows';
  end if;
  update public.camp_steps s set
    camp_id = case when r ? 'camp_id' then (r->>'camp_id')::uuid else s.camp_id end,
    section_id = case when r ? 'section_id' then (r->>'section_id')::uuid else s.section_id end,
    parent_id = case when r ? 'parent_id' then (r->>'parent_id')::uuid else s.parent_id end,
    position = case when r ? 'position' then (r->>'position')::integer else s.position end,
    today_on = case when r ? 'today_on' then (r->>'today_on')::date else s.today_on end,
    updated_at = now()
  from jsonb_array_elements(p_rows) r
  where s.id = (r->>'id')::uuid and s.user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.camp_steps_place(jsonb) from public, anon;
grant execute on function public.camp_steps_place(jsonb) to authenticated;
