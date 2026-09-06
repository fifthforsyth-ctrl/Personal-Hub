-- Mining runs unattended now, which means nobody is there to accept a snippet.
-- So the nightly run keeps what it finds and marks it — you get a short pass
-- over what came in rather than cards appearing silently on the shelf.
alter table public.study_notes
  add column if not exists auto_kept boolean not null default false;

create index if not exists study_notes_auto_kept_idx
  on public.study_notes (user_id, auto_kept, created_at desc)
  where auto_kept;

create or replace function public.unreviewed_auto_cards(p_limit integer default 30)
returns setof public.study_notes
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select * from public.study_notes
  where user_id = auth.uid() and auto_kept
  order by created_at desc
  limit greatest(p_limit, 1);
$$;

-- Looked at. The card stays; it just stops being flagged as unreviewed.
create or replace function public.mark_cards_reviewed(p_ids uuid[])
returns void
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  update public.study_notes
     set auto_kept = false
   where user_id = auth.uid() and id = any(p_ids);
$$;

grant execute on function public.unreviewed_auto_cards(integer) to authenticated;
grant execute on function public.mark_cards_reviewed(uuid[]) to authenticated;

-- Keeping a mined snippet, as one transaction: the card, its essence, and the
-- highlight that anchors it back into the source. Written as an RPC so the
-- nightly job does exactly what the app does rather than a second version of
-- it that drifts.
create or replace function public.keep_snippet(
  p_user_id uuid,
  p_source_id uuid,
  p_quote text,
  p_essence text,
  p_kind text,
  p_start integer,
  p_end integer,
  p_auto boolean default false
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_source public.study_notes;
  v_card uuid;
begin
  if auth.uid() is not null and v_user is distinct from auth.uid() then
    raise exception 'You can only keep your own snippets.';
  end if;

  select * into v_source from public.study_notes
   where id = p_source_id and user_id = v_user;
  if not found then
    raise exception 'That source does not exist.';
  end if;

  insert into public.study_notes
    (user_id, title, body, excerpt, essence, note_kind, parent_note_id, source_ref, studied_on, auto_kept)
  values (
    v_user,
    left(coalesce(nullif(p_essence, ''), p_quote), 90),
    '', p_quote, nullif(p_essence, ''), coalesce(p_kind, 'thought'),
    p_source_id, v_source.source_ref, v_source.studied_on, p_auto
  )
  returning id into v_card;

  insert into public.note_highlights
    (user_id, note_id, child_note_id, quoted_text, start_offset, end_offset)
  values (v_user, p_source_id, v_card, p_quote, p_start, p_end);

  return v_card;
end;
$$;

grant execute on function public.keep_snippet(uuid, uuid, text, text, text, integer, integer, boolean) to authenticated;
grant execute on function public.keep_snippet(uuid, uuid, text, text, text, integer, integer, boolean) to service_role;

-- The nightly job needs the queue without a login; same guard as everywhere
-- else, a signed-in caller may only ever ask for their own.
create or replace function public.unmined_sources_for(p_user_id uuid default null, p_limit integer default 3)
returns table (id uuid, title text, body text, source_ref text, studied_on date)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is not null and v_user is distinct from auth.uid() then
    raise exception 'You can only read your own sources.';
  end if;

  return query
    select n.id, n.title, n.body, n.source_ref, n.studied_on
    from public.study_notes n
    where n.user_id = v_user
      and n.mined_at is null
      and n.parent_note_id is null
      and length(coalesce(n.body, '')) > 400
    order by n.studied_on asc nulls last, n.created_at asc
    limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.unmined_sources_for(uuid, integer) to authenticated;
grant execute on function public.unmined_sources_for(uuid, integer) to service_role;

-- Mining runs on the same nightly rhythm as the curator, thirty minutes ahead
-- of it. The order matters: cards mined tonight are candidates for tonight's
-- selection rather than tomorrow's, and pg_net is fire-and-forget so the gap
-- is what sequences them rather than any coordination between the two.
create or replace function public.trigger_miner()
returns bigint
language plpgsql
volatile
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'curator_cron_secret';

  if v_secret is null then
    raise exception 'curator_cron_secret is not in the vault.';
  end if;

  select net.http_post(
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/miner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_miner() from public, anon, authenticated;

select cron.schedule('miner-nightly', '30 5,6 * * *', $$ select public.trigger_miner(); $$);
