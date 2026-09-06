-- Which long notes have been read for keepable lines.
--
-- Explicit rather than inferred from "has children": a note that was mined and
-- honestly yielded nothing is finished, and inferring from children would
-- offer it up again forever.
alter table public.study_notes
  add column if not exists mined_at timestamptz,
  add column if not exists mined_count integer not null default 0;

-- Sources still to work through, oldest study first — reading the vault in the
-- order it was written is the only order that makes sense.
create or replace function public.unmined_sources(p_limit integer default 25)
returns table (
  id uuid,
  title text,
  source_ref text,
  studied_on date,
  body_length integer,
  ai_theme text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select n.id, n.title, n.source_ref, n.studied_on, length(n.body), n.ai_theme
  from public.study_notes n
  where n.user_id = auth.uid()
    and n.mined_at is null
    and n.parent_note_id is null
    -- A source is something long enough to be worth mining. Short notes are
    -- already cards; running them through this would just copy them.
    and length(coalesce(n.body, '')) > 400
  order by n.studied_on asc nulls last, n.created_at asc
  limit greatest(p_limit, 1);
$$;

-- How much of the vault is left.
create or replace function public.mining_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'sources', count(*) filter (where length(coalesce(body, '')) > 400 and parent_note_id is null),
    'mined', count(*) filter (where length(coalesce(body, '')) > 400 and parent_note_id is null and mined_at is not null),
    'cards_from_sources', (
      select count(*) from public.study_notes c
      where c.user_id = auth.uid() and c.parent_note_id is not null and c.excerpt is not null
    )
  )
  from public.study_notes
  where user_id = auth.uid();
$$;

grant execute on function public.unmined_sources(integer) to authenticated;
grant execute on function public.mining_stats() to authenticated;
