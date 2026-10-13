-- Your own notes on the Board's shelves.
--
-- A shelf (a person, a theme, a mood) showed only quotes found on the web.
-- Now it shows what you wrote too: the board function reads each of your
-- notes and files it under the shelves it belongs on, so a line of Elder
-- Bednar's you wrote down shows up on his shelf, and a thought about
-- getting up early shows up under Discipline.
--
--   shelf_keys    the shelves it's on, as the Board names them:
--                 person:david-a-bednar, theme:discipline, mood:tired
--   shelf_people  the people whose words it records, by name, so someone
--                 who isn't one of the Board's own people still gets a shelf
--   shelved_at    when it was last filed; null means not yet
--
-- Additive only. The note_cards view gains the three columns at its end,
-- which create or replace allows without dropping it.

alter table public.study_notes
  add column if not exists shelf_keys text[] not null default '{}',
  add column if not exists shelf_people text[] not null default '{}',
  add column if not exists shelved_at timestamptz;

create index if not exists study_notes_shelf_keys
  on public.study_notes using gin (shelf_keys);

create or replace view public.note_cards
with (security_invoker = true)
as
  select
    n.id, n.user_id, n.title, n.excerpt, n.essence, n.note_kind,
    n.parent_note_id, n.origin_chunk_id, n.origin_date, n.position, n.pinned,
    n.image_path, n.source_kind, n.source_ref, n.studied_on, n.tags,
    n.ai_theme, n.ai_summary, n.linked_goal_id, n.obsidian_uid,
    n.mined_at, n.mined_count, n.auto_kept,
    n.last_surfaced_at, n.surfaced_count, n.created_at, n.updated_at,
    length(coalesce(n.body, '')) as body_length,
    left(coalesce(n.body, ''), 400) as body_preview,
    n.shelf_keys, n.shelf_people, n.shelved_at
  from public.study_notes n;

grant select on public.note_cards to authenticated;
