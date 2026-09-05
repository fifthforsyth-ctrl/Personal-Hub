-- What a note IS, as opposed to where it came from.
--
-- source_kind already says scripture / conference / come_follow_me. This is a
-- different question: is this an experience you had, something you worked out,
-- something you're wrestling with, or a passing thought. Deliberately a plain
-- text column rather than an enum — the vocabulary belongs to the app and will
-- grow, and adding a kind should not need a migration.
alter table public.study_notes
  add column if not exists note_kind text not null default 'thought';

create index if not exists study_notes_kind_idx
  on public.study_notes (user_id, note_kind, created_at desc);

-- The note of the day.
--
-- Deterministic per date, so it is the SAME note all day on every device
-- rather than reshuffling on each page load — a thought you're meant to carry
-- through the day can't change every time you open the app. The date seeds an
-- index into the candidate list; candidates are ordered least-recently-seen
-- first so the rotation works through everything before repeating.
--
-- Spiritual experiences are weighted to the front: those are the ones worth
-- being handed back unprompted.
create or replace function public.note_of_the_day(p_date date default current_date)
returns setof public.study_notes
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_offset integer;
begin
  select count(*) into v_count
  from public.study_notes n
  where n.user_id = auth.uid()
    and length(coalesce(nullif(n.body, ''), n.excerpt, '')) > 25;

  if v_count = 0 then
    return;
  end if;

  -- hashtext is stable for a given input, so the same date and the same user
  -- always land on the same row.
  v_offset := abs(hashtext(p_date::text || auth.uid()::text)) % v_count;

  return query
    select *
    from public.study_notes n
    where n.user_id = auth.uid()
      and length(coalesce(nullif(n.body, ''), n.excerpt, '')) > 25
    order by
      (n.note_kind = 'revelation') desc,
      n.pinned desc,
      n.last_surfaced_at asc nulls first,
      n.id
    offset v_offset
    limit 1;
end;
$$;

grant execute on function public.note_of_the_day(date) to authenticated;
