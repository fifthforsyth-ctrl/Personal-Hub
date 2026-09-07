-- The list view of notes.
--
-- Two problems this fixes at once. The client was naming columns explicitly
-- and had already fallen behind twice — image_path was missing, which is why
-- pictures never appeared on the wall. And it was pulling every full body:
-- sixty-one vault notes at eleven thousand characters is about 700KB on every
-- load of the study page, to render titles and three-line previews.
--
-- So: everything except the body, plus a preview of it. The whole body is
-- fetched only when a note is actually opened.
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
    left(coalesce(n.body, ''), 400) as body_preview
  from public.study_notes n;

grant select on public.note_cards to authenticated;
