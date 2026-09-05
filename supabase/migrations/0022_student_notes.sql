-- The student section: reading notes that nest, highlights that anchor into
-- them, and a way to bring old ones back.
--
-- This extends study_notes rather than adding a parallel notes table. Notes
-- pushed in from Obsidian already live there, and they should be highlightable
-- like anything else you read — a second table would have meant two kinds of
-- note that can never quote each other.

alter table public.study_notes
  -- on delete set null, not cascade: deleting a book must not silently take
  -- every insight you had while reading it. Orphans surface at the top level
  -- of the directory where you can see and re-file them.
  add column if not exists parent_note_id uuid references public.study_notes(id) on delete set null,
  -- The passage a sub-note grew out of, copied at creation. Kept on the child
  -- so the quote survives even if the parent's text is later rewritten.
  add column if not exists excerpt text,
  add column if not exists position integer not null default 0,
  add column if not exists pinned boolean not null default false,
  add column if not exists last_surfaced_at timestamptz,
  add column if not exists surfaced_count integer not null default 0;

create index if not exists study_notes_parent_idx
  on public.study_notes (user_id, parent_note_id, position);

-- A highlight is a range over a note's body text.
--
-- Offsets alone are brittle — one edit above a highlight shifts every offset
-- below it — so the quoted text is stored alongside them and the reader
-- re-finds the passage by text when the offsets no longer match. A highlight
-- that can't be found either way is shown separately rather than dropped.
create table if not exists public.note_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.study_notes(id) on delete cascade,
  -- Set when the highlight was promoted into its own note. A plain highlight
  -- leaves this null.
  child_note_id uuid references public.study_notes(id) on delete set null,
  quoted_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  color text not null default 'accent',
  created_at timestamptz not null default now()
);

create index if not exists note_highlights_note_idx
  on public.note_highlights (user_id, note_id, start_offset);

alter table public.note_highlights enable row level security;

create policy "own note highlights" on public.note_highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Resurfacing. Least-recently-seen first, with a random tiebreak so a shelf
-- of never-surfaced notes doesn't always hand back the same one. Pinned notes
-- are always eligible; everything else waits out a cooling-off period so the
-- same insight doesn't reappear two days running.
create or replace function public.notes_to_resurface(p_limit integer default 3, p_cooldown_days integer default 14)
returns setof public.study_notes
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select *
  from public.study_notes n
  where n.user_id = auth.uid()
    and length(coalesce(n.body, '')) > 40
    and (
      n.pinned
      or n.last_surfaced_at is null
      or n.last_surfaced_at < now() - make_interval(days => p_cooldown_days)
    )
  order by n.pinned desc, n.last_surfaced_at asc nulls first, random()
  limit greatest(p_limit, 1);
$$;

create or replace function public.mark_note_surfaced(p_note_id uuid)
returns void
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  update public.study_notes
     set last_surfaced_at = now(),
         surfaced_count = surfaced_count + 1
   where id = p_note_id and user_id = auth.uid();
$$;

grant execute on function public.notes_to_resurface(integer, integer) to authenticated;
grant execute on function public.mark_note_surfaced(uuid) to authenticated;
