-- Board and Money fixes. Apply after 0055; nothing here depends on 0056 or
-- 0057. Every function keeps its signature and return columns, so the app
-- that's live while this is applied keeps working against it.
--
-- 1. "Older purchases" asked about this month's purchases too. In history
--    mode purchase_inbox returned every unsorted purchase, newest first, so
--    the everyday question and the Older purchases card opened on the same
--    receipt, and answering it in one left the other still asking. History
--    is now only what the everyday question doesn't cover: purchases posted
--    before question_cutoff().
--
-- 2. Keeping a mined line twice made two cards. A double tap on "Keep it"
--    wrote a second card and a second highlight for the same words, and so
--    would a nightly run that went over a passage already kept. keep_snippet
--    now hands back the card that already holds that exact passage of that
--    source, and takes a lock on the passage first so two taps that arrive
--    together can't both get past the check. Not a unique index: four plain
--    highlights in the live data repeat a range, and "make a note" from a
--    selection inserts directly, so a constraint could start failing it.
--    The card's title is cut at a word with an ellipsis now, not mid-word at
--    90 characters.
--
-- 3. The board's search only read titles and the first 400 characters,
--    because the page holds note_cards, which carries a preview rather than
--    the body. search_notes reads every word of every note server-side,
--    yours only, and sends back a short window around the first match
--    rather than the body itself.

-- 1 ------------------------------------------------------------------------

create or replace function public.purchase_inbox(p_limit integer default 25, p_include_history boolean default false)
returns table (
  id uuid, posted_at timestamptz, amount numeric, description text, merchant_key text,
  account_name text, account_kind text, is_business boolean, business_category text,
  suggested_budget_id uuid, suggested_kind text, receipts integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select t.id, t.posted_at, t.amount, t.description, t.merchant_key,
         coalesce(a.nickname, a.name), a.kind, t.is_business, t.business_category,
         t.suggested_budget_id, t.suggested_kind,
         (select count(*)::int from public.receipts r where r.transaction_id = t.id)
  from public.bank_transactions t
  left join public.bank_accounts a on a.id = t.account_id
  where t.user_id = auth.uid()
    and t.reviewed_at is null and not t.is_transfer and t.amount < 0
    -- The two cards split the queue at the same line money_inbox_counts
    -- does, so their counts and their questions agree.
    and case when p_include_history
             then t.posted_at < public.question_cutoff()
             else t.posted_at >= public.question_cutoff()
        end
  order by t.posted_at desc
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.purchase_inbox(integer, boolean) from public, anon;
grant execute on function public.purchase_inbox(integer, boolean) to authenticated, service_role;

-- 2 ------------------------------------------------------------------------

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
  v_title text;
begin
  if auth.uid() is not null and v_user is distinct from auth.uid() then
    raise exception 'You can only keep your own snippets.';
  end if;

  select * into v_source from public.study_notes
   where id = p_source_id and user_id = v_user;
  if not found then
    raise exception 'That source does not exist.';
  end if;

  -- One keeper per passage at a time. The second of two calls that arrive
  -- together waits here until the first commits, then finds its card below.
  perform pg_advisory_xact_lock(hashtextextended('keep_snippet:' || p_source_id::text || ':' || p_start || ':' || p_end, 0));

  select h.child_note_id into v_card
    from public.note_highlights h
   where h.user_id = v_user
     and h.note_id = p_source_id
     and h.start_offset = p_start
     and h.end_offset = p_end
     and h.child_note_id is not null
   order by h.created_at
   limit 1;

  if v_card is not null then
    -- Kept by hand after the nightly run had already kept it: that counts
    -- as having looked at it.
    if not coalesce(p_auto, false) then
      update public.study_notes set auto_kept = false where id = v_card and auto_kept;
    end if;
    return v_card;
  end if;

  -- The title is what the shelf lists, so it ends on a whole word.
  v_title := btrim(coalesce(nullif(btrim(p_essence), ''), p_quote));
  if length(v_title) > 90 then
    v_title := case
      when substr(v_title, 90, 1) ~ '\s' then left(v_title, 89)
      else regexp_replace(left(v_title, 89), '\s+\S*$', '')
    end;
    v_title := regexp_replace(v_title, '[\s,;:.–—-]+$', '') || '…';
  end if;

  insert into public.study_notes
    (user_id, title, body, excerpt, essence, note_kind, parent_note_id, source_ref, studied_on, auto_kept)
  values (
    v_user,
    v_title,
    '',
    p_quote,
    nullif(p_essence, ''),
    coalesce(p_kind, 'thought'),
    p_source_id,
    v_source.source_ref,
    v_source.studied_on,
    coalesce(p_auto, false)
  )
  returning id into v_card;

  insert into public.note_highlights
    (user_id, note_id, child_note_id, quoted_text, start_offset, end_offset)
  values (v_user, p_source_id, v_card, p_quote, p_start, p_end);

  return v_card;
end;
$$;

revoke execute on function public.keep_snippet(uuid, uuid, text, text, text, integer, integer, boolean) from public, anon;
grant execute on function public.keep_snippet(uuid, uuid, text, text, text, integer, integer, boolean) to authenticated, service_role;

-- 3 ------------------------------------------------------------------------

-- Every word has to appear somewhere in the note (title, body, the quoted
-- passage, its essence or where it's from), in any order. Matching is plain
-- substring on lowercased text, so nothing typed is ever read as a pattern.
create or replace function public.search_notes(p_query text, p_limit integer default 30)
returns table (
  id uuid, title text, note_kind text, parent_note_id uuid, excerpt text, essence text,
  source_ref text, created_at timestamptz, snippet text, in_title boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select array_agg(w) as words
    from (
      select lower(w) as w
      from regexp_split_to_table(btrim(coalesce(p_query, '')), '\s+') as w
      where length(w) > 0
      limit 8
    ) x
  ), notes as (
    select n.id, n.title, n.note_kind, n.parent_note_id, n.excerpt, n.essence, n.source_ref,
           n.created_at, n.updated_at, coalesce(n.body, '') as body,
           lower(n.title || ' ' || coalesce(n.body, '') || ' ' || coalesce(n.excerpt, '') || ' ' ||
                 coalesce(n.essence, '') || ' ' || coalesce(n.source_ref, '')) as hay
    from public.study_notes n
    where n.user_id = auth.uid()
  ), hits as (
    select n.*,
           (select min(nullif(strpos(lower(n.body), w), 0)) from unnest(q.words) w) as at,
           (select bool_and(strpos(lower(n.title), w) > 0) from unnest(q.words) w) as in_title
    from notes n, q
    where q.words is not null
      and (select bool_and(strpos(n.hay, w) > 0) from unnest(q.words) w)
  )
  select h.id, h.title, h.note_kind, h.parent_note_id, h.excerpt, h.essence, h.source_ref, h.created_at,
         -- A window around the first match in the body, for the result line.
         case when h.at is not null then substr(h.body, greatest(h.at - 70, 1), 220) end,
         h.in_title
  from hits h
  order by h.in_title desc, h.updated_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

revoke execute on function public.search_notes(text, integer) from public, anon;
grant execute on function public.search_notes(text, integer) to authenticated, service_role;
