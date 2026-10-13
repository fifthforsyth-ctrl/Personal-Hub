-- Pictures for your own thoughts.
--
-- Quotes on the Board each come with a picture from the web. Now your own
-- notes can too: when the board function files a note, it also picks a
-- photograph that stands for the thought (a symbol, a place, a scene) and
-- keeps its address here. A picture you add yourself (image_path) still
-- comes first.
--
--   image_url     the picture, on the web
--   image_credit  where it came from, e.g. Wikimedia Commons
--   image_page    the page it was found on
--   pictured_at   when one was looked for; set even when none was found, or
--                 when you took it off, so it isn't put back
--
-- Additive only. The note_cards view gains the columns at its end.

alter table public.study_notes
  add column if not exists image_url text,
  add column if not exists image_credit text,
  add column if not exists image_page text,
  add column if not exists pictured_at timestamptz;

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
    n.shelf_keys, n.shelf_people, n.shelved_at,
    n.image_url, n.image_credit, n.image_page, n.pictured_at
  from public.study_notes n;

grant select on public.note_cards to authenticated;
