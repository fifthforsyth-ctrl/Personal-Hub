-- Three things: notes that live on a time block, quotes that carry an image,
-- and a curator that chooses what you see each day and learns from how you
-- rate it.

-- ---------------------------------------------------------------------------
-- 1. Meeting notes belong to the block they happened in
-- ---------------------------------------------------------------------------
-- Not a separate note type. A meeting is an hour of your day, so its notes
-- hang off that hour — and highlighting a line from them makes a card that
-- points back at the day it was said.
alter table public.time_chunks
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- 2. A highlight can now anchor to a block's notes as well as a note's body
-- ---------------------------------------------------------------------------
alter table public.note_highlights
  alter column note_id drop not null;

alter table public.note_highlights
  add column if not exists chunk_id uuid references public.time_chunks(id) on delete cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'note_highlights_one_anchor') then
    alter table public.note_highlights
      add constraint note_highlights_one_anchor check (num_nonnulls(note_id, chunk_id) = 1);
  end if;
end $$;

create index if not exists note_highlights_chunk_idx
  on public.note_highlights (user_id, chunk_id, start_offset);

-- ---------------------------------------------------------------------------
-- 3. Cards: where they came from, their one-line form, and their picture
-- ---------------------------------------------------------------------------
alter table public.study_notes
  -- A card lifted out of a meeting keeps the way back to the whole record.
  add column if not exists origin_chunk_id uuid references public.time_chunks(id) on delete set null,
  add column if not exists origin_date date,
  -- The one line you actually see when this resurfaces. The body is what you
  -- wrote; this is what it comes back as. Six hundred words is wallpaper.
  add column if not exists essence text,
  -- Storage object path for a quote's image. Path, not URL — signed URLs
  -- expire and must never be what's persisted.
  add column if not exists image_path text;

create index if not exists study_notes_origin_chunk_idx
  on public.study_notes (user_id, origin_chunk_id);

-- ---------------------------------------------------------------------------
-- 4. The curator's daily choice, and how well it landed
-- ---------------------------------------------------------------------------
-- One selection per day. The point is not "you haven't seen this in a while"
-- — it's "this applies to you now" — so each item carries the reason it was
-- chosen, and you score how well it actually fit. Those scores are what the
-- next run reads to choose better.
create table if not exists public.daily_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  -- The curator's read of where you are right now, in a sentence or two.
  situation text,
  created_at timestamptz not null default now(),
  unique (user_id, for_date)
);

create table if not exists public.daily_selection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selection_id uuid not null references public.daily_selections(id) on delete cascade,
  note_id uuid not null references public.study_notes(id) on delete cascade,
  -- 'home' rotates on the front page; 'day' sits with the day's own card.
  slot text not null check (slot in ('home', 'day')),
  position integer not null default 0,
  reason text not null,
  score integer check (score between 1 and 10),
  feedback text,
  scored_at timestamptz
);

create index if not exists daily_selection_items_sel_idx
  on public.daily_selection_items (user_id, selection_id, slot, position);

create index if not exists daily_selection_items_scored_idx
  on public.daily_selection_items (user_id, scored_at desc nulls last);

alter table public.daily_selections enable row level security;
alter table public.daily_selection_items enable row level security;

create policy "own daily selections" on public.daily_selections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own daily selection items" on public.daily_selection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Everything the app needs to render today's picks, in one call.
create or replace function public.daily_selection(p_date date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'for_date', s.for_date,
    'situation', s.situation,
    'created_at', s.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'slot', i.slot,
        'position', i.position,
        'reason', i.reason,
        'score', i.score,
        'feedback', i.feedback,
        'note', to_jsonb(n)
      ) order by i.slot, i.position)
      from public.daily_selection_items i
      join public.study_notes n on n.id = i.note_id
      where i.selection_id = s.id
    ), '[]'::jsonb)
  )
  from public.daily_selections s
  where s.user_id = auth.uid() and s.for_date = p_date;
$$;

grant execute on function public.daily_selection(date) to authenticated;
