-- Sweet somethings.
--
-- A sweet something is a small thing that made you happy. When you keep a
-- thought on the Board you can tick the circle that marks it as one, and the
-- Board's "Sweet somethings" view shows only those.
--
--   sweet   true when the thought is a sweet something
--
-- Additive only. The note_cards view gains the column at its end.

alter table public.study_notes
  add column if not exists sweet boolean not null default false;

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
    n.image_url, n.image_credit, n.image_page, n.pictured_at,
    n.sweet
  from public.study_notes n;

grant select on public.note_cards to authenticated;
