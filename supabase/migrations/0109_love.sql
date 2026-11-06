-- Love: a shared tab for two people who both use the Hub (2026-11-06).
--
-- Aaron and Zimira each have their own account in this project. Everything
-- else in the Hub stays strictly private (auth.uid() = user_id); the only
-- things either of them can see of the other's are written here, into
-- tables that belong to the pair:
--
--   love_pairs      the pair: who invited whom, pending until accepted.
--   love_members    each person in a pair, the name the other sees and the
--                     @handles that mention them (e.g. zimi, zimira).
--   love_mentions   an answer from your own evening journal that @mentions
--                     the other person. Only that one answer is shared, and
--                     it stays in step with the journal (edit it and the
--                     shared copy follows; take the @ out and it's unshared).
--                     Written only by the trigger on journal_entries.
--   love_quotes     a quote sent to the other person. A copy lands on their
--                     Board (quotes, saved) with "From <name>" as its reason.
--   love_dates      date ideas, planned dates and dates done. A planned date
--                     with a time is put on both people's schedules
--                     (time_chunks.love_date_id) and kept in step.
--   love_ratings    each person's 1-10 on five things for a date done.
--   love_shares     a banked day or an achievement shared with the other.
--   love_comments   a comment on a mention, a date, a quote or a share.
--   love_alerts     "Aaron mentioned you", "Zimira rated your date": one row
--                     per thing the other person did, for the recipient.
--   push_subscriptions  each phone or browser that turned notifications on.
--
-- Alerts are pushed to the phone by the love-push edge function, which a
-- cron job calls each minute while there are alerts a minute old or more
-- (the minute lets a journal answer that's still being typed settle first).
--
-- Additive only: new tables, functions, triggers and one cron job, plus two
-- new nullable columns (time_chunks.love_date_id, quotes.love_quote_id).
-- Nothing existing changes meaning.
--
-- Rollback (SQL Editor):
--   select cron.unschedule('love-push');
--   drop trigger if exists journal_love_mentions on public.journal_entries;
--   alter table public.time_chunks drop column if exists love_date_id;
--   alter table public.quotes drop column if exists love_quote_id;
--   drop table if exists public.love_alerts, public.love_comments, public.love_shares,
--     public.love_ratings, public.love_dates, public.love_quotes, public.love_mentions,
--     public.love_members, public.love_pairs, public.push_subscriptions cascade;
--   drop function if exists public.love_journal_mentions(), public.love_dates_sync(),
--     public.love_alert(uuid, uuid, text, text, uuid, text, text), public.love_pair_of(uuid),
--     public.love_partner_of(uuid), public.is_love_member(uuid), public.love_name(uuid, uuid),
--     public.love_invite(text, text, text, text[], text[]), public.love_my_invites(),
--     public.love_accept(uuid), public.love_decline(uuid), public.love_end(),
--     public.love_set_me(text, text[]), public.love_send_quote(uuid, text),
--     public.love_push_tick(), public.love_alerts_on_mention(), public.love_alerts_on_quote(),
--     public.love_alerts_on_date(), public.love_alerts_on_rating(), public.love_alerts_on_share(),
--     public.love_alerts_on_comment(), public.love_touch();

-- ---------------------------------------------------------------------------
-- The pair
-- ---------------------------------------------------------------------------

create table if not exists public.love_pairs (
  id uuid primary key default gen_random_uuid(),
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Who was invited, by the email they sign in with.
  invite_email text not null check (invite_email = lower(btrim(invite_email)) and invite_email like '%@%'),
  -- The invited person's name and handles as the inviter set them; copied
  -- onto their member row when they accept, and theirs to change after.
  invite_name text not null check (char_length(btrim(invite_name)) between 1 and 40),
  invite_handles text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.love_members (
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Lowercase letters, digits and underscores only, without the @.
  handles text[] not null default '{}' check (array_to_string(handles, ',') ~ '^([a-z0-9_]{2,24}(,[a-z0-9_]{2,24})*)?$'),
  joined_at timestamptz not null default now(),
  primary key (pair_id, user_id)
);

create index if not exists love_members_user on public.love_members (user_id);

-- The pair a person is in now (only one at a time).
create or replace function public.love_pair_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.pair_id
  from public.love_members m
  join public.love_pairs p on p.id = m.pair_id
  where m.user_id = p_user and p.status = 'active'
  order by p.accepted_at desc nulls last
  limit 1;
$$;

create or replace function public.love_partner_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id
  from public.love_members m
  where m.pair_id = public.love_pair_of(p_user) and m.user_id <> p_user
  limit 1;
$$;

-- Is the signed-in person in this pair (and is it still on)?
create or replace function public.is_love_member(p_pair uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.love_members m
    join public.love_pairs p on p.id = m.pair_id
    where m.pair_id = p_pair and m.user_id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.love_name(p_pair uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select name from public.love_members where pair_id = p_pair and user_id = p_user;
$$;

revoke all on function public.love_pair_of(uuid) from public, anon;
revoke all on function public.love_partner_of(uuid) from public, anon;
revoke all on function public.is_love_member(uuid) from public, anon;
revoke all on function public.love_name(uuid, uuid) from public, anon;
grant execute on function public.love_pair_of(uuid) to authenticated;
grant execute on function public.love_partner_of(uuid) to authenticated;
grant execute on function public.is_love_member(uuid) to authenticated;
grant execute on function public.love_name(uuid, uuid) to authenticated;

alter table public.love_pairs enable row level security;
alter table public.love_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_pairs' and policyname = 'Love pair members') then
    create policy "Love pair members" on public.love_pairs
      for select to authenticated
      using (invited_by = auth.uid() or exists (select 1 from public.love_members m where m.pair_id = love_pairs.id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_members' and policyname = 'Love members see each other') then
    create policy "Love members see each other" on public.love_members
      for select to authenticated
      using (user_id = auth.uid() or public.is_love_member(pair_id));
  end if;
end $$;

grant select on public.love_pairs to authenticated;
grant select on public.love_members to authenticated;

-- Invite someone by the email they sign in with. Your own name and handles
-- go on your member row; theirs wait on the pair until they accept.
create or replace function public.love_invite(
  p_email text, p_my_name text, p_their_name text, p_my_handles text[], p_their_handles text[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_pair uuid;
  v_email text := lower(btrim(p_email));
begin
  if v_me is null then raise exception 'Sign in first.'; end if;
  if public.love_pair_of(v_me) is not null then raise exception 'You''re already paired.'; end if;
  if v_email = lower((select email from auth.users where id = v_me)) then raise exception 'That''s your own email.'; end if;

  -- One open invite at a time: a new one replaces the old.
  update public.love_pairs set status = 'ended', ended_at = now()
  where invited_by = v_me and status = 'pending';

  insert into public.love_pairs (invited_by, invite_email, invite_name, invite_handles)
  values (v_me, v_email, btrim(p_their_name), coalesce(p_their_handles, '{}'))
  returning id into v_pair;

  insert into public.love_members (pair_id, user_id, name, handles)
  values (v_pair, v_me, btrim(p_my_name), coalesce(p_my_handles, '{}'));

  return v_pair;
end;
$$;

-- Invites waiting for the signed-in person.
create or replace function public.love_my_invites()
returns table (pair_id uuid, from_name text, my_name text, my_handles text[], created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, m.name, p.invite_name, p.invite_handles, p.created_at
  from public.love_pairs p
  join public.love_members m on m.pair_id = p.id and m.user_id = p.invited_by
  where p.status = 'pending'
    and p.invite_email = lower((select email from auth.users where id = auth.uid()))
  order by p.created_at desc;
$$;

create or replace function public.love_accept(p_pair uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  p public.love_pairs%rowtype;
begin
  select * into p from public.love_pairs where id = p_pair for update;
  if not found or p.status <> 'pending'
     or p.invite_email <> lower((select email from auth.users where id = v_me)) then
    raise exception 'That invite isn''t open any more.';
  end if;
  if public.love_pair_of(v_me) is not null or public.love_pair_of(p.invited_by) is not null then
    raise exception 'One of you is already paired.';
  end if;
  insert into public.love_members (pair_id, user_id, name, handles)
  values (p.id, v_me, p.invite_name, p.invite_handles);
  update public.love_pairs set status = 'active', accepted_at = now() where id = p.id;
  return p.id;
end;
$$;

create or replace function public.love_decline(p_pair uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.love_pairs set status = 'ended', ended_at = now()
  where id = p_pair and status = 'pending'
    and (invited_by = auth.uid() or invite_email = lower((select email from auth.users where id = auth.uid())));
$$;

-- Ends the pair for both. What was shared stays in the tables (hidden,
-- since nobody is an active member), so nothing is lost by a slip.
create or replace function public.love_end()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.love_pairs set status = 'ended', ended_at = now()
  where id = public.love_pair_of(auth.uid());
$$;

create or replace function public.love_set_me(p_name text, p_handles text[])
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.love_members set name = btrim(p_name), handles = coalesce(p_handles, '{}')
  where user_id = auth.uid() and pair_id = public.love_pair_of(auth.uid());
$$;

revoke all on function public.love_invite(text, text, text, text[], text[]) from public, anon;
revoke all on function public.love_my_invites() from public, anon;
revoke all on function public.love_accept(uuid) from public, anon;
revoke all on function public.love_decline(uuid) from public, anon;
revoke all on function public.love_end() from public, anon;
revoke all on function public.love_set_me(text, text[]) from public, anon;
grant execute on function public.love_invite(text, text, text, text[], text[]) to authenticated;
grant execute on function public.love_my_invites() to authenticated;
grant execute on function public.love_accept(uuid) to authenticated;
grant execute on function public.love_decline(uuid) to authenticated;
grant execute on function public.love_end() to authenticated;
grant execute on function public.love_set_me(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- What the pair shares
-- ---------------------------------------------------------------------------

create table if not exists public.love_mentions (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  journal_date date not null,
  -- The journal_entries column it came from, and the question it answered.
  field text not null,
  label text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author, journal_date, field)
);

create table if not exists public.love_quotes (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  -- The copy on the recipient's Board.
  copy_id uuid references public.quotes(id) on delete set null,
  text text not null,
  author text not null,
  source text,
  image_url text,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.quotes add column if not exists love_quote_id uuid references public.love_quotes(id) on delete set null;

create table if not exists public.love_dates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  place text check (place is null or char_length(place) <= 120),
  status text not null default 'idea' check (status in ('idea', 'planned', 'done')),
  on_date date,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint love_dates_planned check (status = 'idea' or on_date is not null),
  constraint love_dates_times check ((start_time is null) = (end_time is null) and (start_time is null or end_time > start_time))
);

create index if not exists love_dates_pair on public.love_dates (pair_id, status, on_date);

alter table public.time_chunks add column if not exists love_date_id uuid references public.love_dates(id) on delete cascade;
create index if not exists time_chunks_love_date on public.time_chunks (love_date_id) where love_date_id is not null;

create table if not exists public.love_ratings (
  date_id uuid not null references public.love_dates(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  fun smallint check (fun between 1 and 10),
  romance smallint check (romance between 1 and 10),
  zest smallint check (zest between 1 and 10),
  connection smallint check (connection between 1 and 10),
  -- 'shall not be named'
  unnamed smallint check (unnamed between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date_id, user_id)
);

create table if not exists public.love_shares (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('banked_day', 'achievement')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text check (body is null or char_length(body) <= 4000),
  ref_date date,
  -- A banked day's numbers (wins, minutes, tasks), drawn as they were.
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.love_comments (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('mention', 'quote', 'date', 'share')),
  subject_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists love_comments_subject on public.love_comments (subject_kind, subject_id, created_at);

create table if not exists public.love_alerts (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.love_pairs(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  subject_kind text not null,
  subject_id uuid not null,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);

create index if not exists love_alerts_recipient on public.love_alerts (recipient, created_at desc);
create index if not exists love_alerts_unpushed on public.love_alerts (created_at) where pushed_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failed_at timestamptz
);

alter table public.love_mentions enable row level security;
alter table public.love_quotes enable row level security;
alter table public.love_dates enable row level security;
alter table public.love_ratings enable row level security;
alter table public.love_shares enable row level security;
alter table public.love_comments enable row level security;
alter table public.love_alerts enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
begin
  -- Mentions and quotes are written by the server only (trigger, RPC).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_mentions' and policyname = 'Pair reads mentions') then
    create policy "Pair reads mentions" on public.love_mentions for select to authenticated using (public.is_love_member(pair_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_quotes' and policyname = 'Pair reads quotes') then
    create policy "Pair reads quotes" on public.love_quotes for select to authenticated using (public.is_love_member(pair_id));
  end if;

  -- Dates belong to both: either can add, change or remove one.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_dates' and policyname = 'Pair keeps dates') then
    create policy "Pair keeps dates" on public.love_dates for all to authenticated
      using (public.is_love_member(pair_id)) with check (public.is_love_member(pair_id));
  end if;

  -- Ratings: both can read; each writes only their own.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_ratings' and policyname = 'Pair reads ratings') then
    create policy "Pair reads ratings" on public.love_ratings for select to authenticated using (public.is_love_member(pair_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_ratings' and policyname = 'Own ratings') then
    create policy "Own ratings" on public.love_ratings for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_love_member(pair_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_shares' and policyname = 'Pair reads shares') then
    create policy "Pair reads shares" on public.love_shares for select to authenticated using (public.is_love_member(pair_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_shares' and policyname = 'Own shares') then
    create policy "Own shares" on public.love_shares for all to authenticated
      using (author = auth.uid()) with check (author = auth.uid() and public.is_love_member(pair_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_comments' and policyname = 'Pair reads comments') then
    create policy "Pair reads comments" on public.love_comments for select to authenticated using (public.is_love_member(pair_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_comments' and policyname = 'Own comments') then
    create policy "Own comments" on public.love_comments for all to authenticated
      using (author = auth.uid()) with check (author = auth.uid() and public.is_love_member(pair_id));
  end if;

  -- Alerts: yours to read and mark read; made by the triggers below.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_alerts' and policyname = 'Own alerts') then
    create policy "Own alerts" on public.love_alerts for select to authenticated using (recipient = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_alerts' and policyname = 'Mark own alerts read') then
    create policy "Mark own alerts read" on public.love_alerts for update to authenticated
      using (recipient = auth.uid()) with check (recipient = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Own push subscriptions') then
    create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

grant select on public.love_mentions, public.love_quotes to authenticated;
grant select, insert, update, delete on public.love_dates, public.love_ratings, public.love_shares, public.love_comments to authenticated;
grant select on public.love_alerts to authenticated;
grant update (read_at) on public.love_alerts to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.love_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger love_dates_touch before update on public.love_dates for each row execute function public.love_touch();
create or replace trigger love_ratings_touch before update on public.love_ratings for each row execute function public.love_touch();

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

-- One alert for the other person in the pair.
create or replace function public.love_alert(
  p_pair uuid, p_actor uuid, p_kind text, p_subject_kind text, p_subject uuid, p_title text, p_body text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_to uuid;
begin
  select user_id into v_to from public.love_members where pair_id = p_pair and user_id <> p_actor limit 1;
  if v_to is null then return; end if;
  insert into public.love_alerts (pair_id, recipient, actor, kind, subject_kind, subject_id, title, body)
  values (p_pair, v_to, p_actor, p_kind, p_subject_kind, p_subject, p_title, left(p_body, 300));
end;
$$;

revoke all on function public.love_alert(uuid, uuid, text, text, uuid, text, text) from public, anon, authenticated;

create or replace function public.love_alerts_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.love_alert(new.pair_id, new.author, 'mention', 'mention', new.id,
    public.love_name(new.pair_id, new.author) || ' mentioned you in a journal entry', new.body);
  return null;
end;
$$;

create or replace function public.love_alerts_on_quote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.love_alert(new.pair_id, new.sender, 'quote', 'quote', new.id,
    public.love_name(new.pair_id, new.sender) || ' sent you a quote',
    coalesce(nullif(btrim(new.note), '') || ' · ', '') || '"' || new.text || '" (' || new.author || ')');
  return null;
end;
$$;

create or replace function public.love_alerts_on_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.created_by);
  v_name text := public.love_name(new.pair_id, v_actor);
  v_when text := case when new.on_date is null then null
    else to_char(new.on_date, 'Dy Mon FMDD') ||
      coalesce(' at ' || ltrim(to_char(new.start_time, 'HH12:MI'), '0') || lower(to_char(new.start_time, ' AM')), '') end;
begin
  if tg_op = 'INSERT' then
    if new.status = 'idea' then
      perform public.love_alert(new.pair_id, v_actor, 'date_idea', 'date', new.id, v_name || ' added a date idea', new.title);
    elsif new.status = 'planned' then
      perform public.love_alert(new.pair_id, v_actor, 'date_planned', 'date', new.id, v_name || ' planned a date', new.title || coalesce(', ' || v_when, ''));
    else
      perform public.love_alert(new.pair_id, v_actor, 'date_done', 'date', new.id, v_name || ' added a date you did', new.title || '. Rate it!');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'planned' then
      perform public.love_alert(new.pair_id, v_actor, 'date_planned', 'date', new.id, v_name || ' planned a date', new.title || coalesce(', ' || v_when, ''));
    elsif new.status = 'done' then
      perform public.love_alert(new.pair_id, v_actor, 'date_done', 'date', new.id, v_name || ' marked a date done', new.title || '. Rate it!');
    end if;
  elsif new.status = 'planned' and (new.on_date, new.start_time) is distinct from (old.on_date, old.start_time) then
    perform public.love_alert(new.pair_id, v_actor, 'date_moved', 'date', new.id, v_name || ' moved a date', new.title || coalesce(', now ' || v_when, ''));
  end if;
  return null;
end;
$$;

create or replace function public.love_alerts_on_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  -- Only the first time each person rates a date.
  select title into v_title from public.love_dates where id = new.date_id;
  perform public.love_alert(new.pair_id, new.user_id, 'rating', 'date', new.date_id,
    public.love_name(new.pair_id, new.user_id) || ' rated your date', v_title);
  return null;
end;
$$;

create or replace function public.love_alerts_on_share()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.love_alert(new.pair_id, new.author, new.kind, 'share', new.id,
    public.love_name(new.pair_id, new.author) || case new.kind when 'banked_day' then ' shared a banked day' else ' shared an achievement' end,
    new.title);
  return null;
end;
$$;

create or replace function public.love_alerts_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_on text := case new.subject_kind
    when 'mention' then ' on a journal entry'
    when 'quote' then ' on a quote'
    when 'date' then coalesce(' on "' || (select title from public.love_dates where id = new.subject_id) || '"', ' on a date')
    else ' on ' || coalesce('"' || (select title from public.love_shares where id = new.subject_id) || '"', 'a share')
  end;
begin
  perform public.love_alert(new.pair_id, new.author, 'comment', new.subject_kind, new.subject_id,
    public.love_name(new.pair_id, new.author) || ' commented' || v_on, new.body);
  return null;
end;
$$;

revoke all on function public.love_alerts_on_mention() from public, anon, authenticated;
revoke all on function public.love_alerts_on_quote() from public, anon, authenticated;
revoke all on function public.love_alerts_on_date() from public, anon, authenticated;
revoke all on function public.love_alerts_on_rating() from public, anon, authenticated;
revoke all on function public.love_alerts_on_share() from public, anon, authenticated;
revoke all on function public.love_alerts_on_comment() from public, anon, authenticated;

create or replace trigger love_mentions_alert after insert on public.love_mentions for each row execute function public.love_alerts_on_mention();
create or replace trigger love_quotes_alert after insert on public.love_quotes for each row execute function public.love_alerts_on_quote();
create or replace trigger love_dates_alert after insert or update on public.love_dates for each row execute function public.love_alerts_on_date();
create or replace trigger love_ratings_alert after insert on public.love_ratings for each row execute function public.love_alerts_on_rating();
create or replace trigger love_shares_alert after insert on public.love_shares for each row execute function public.love_alerts_on_share();
create or replace trigger love_comments_alert after insert on public.love_comments for each row execute function public.love_alerts_on_comment();

-- ---------------------------------------------------------------------------
-- Journal mentions
-- ---------------------------------------------------------------------------

-- Each saved journal answer that @mentions the other person is shared (only
-- that answer); one that no longer does is unshared. Runs as the journal is
-- saved, so it works from every screen that writes the journal.
create or replace function public.love_journal_mentions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pair uuid := public.love_pair_of(new.user_id);
  v_handles text[];
  v_pattern text;
  f record;
begin
  if v_pair is null then return null; end if;
  select handles into v_handles from public.love_members
  where pair_id = v_pair and user_id <> new.user_id limit 1;
  if v_handles is null or cardinality(v_handles) = 0 then return null; end if;
  -- @zimi or @zimira, not inside an email or a longer word.
  v_pattern := '(^|[^[:alnum:]_.])@(' || array_to_string(v_handles, '|') || ')([^[:alnum:]_]|$)';

  for f in
    select * from (values
      ('gods_hand', 'God''s hand', new.gods_hand),
      ('q_savior', 'Toward the Savior', new.q_savior),
      ('q_learn', 'Learning from today', new.q_learn),
      ('q_christ', 'Centered', new.q_christ),
      ('q_principles', 'Principles', new.q_principles),
      ('q_success', 'Direction', new.q_success),
      ('gratitude', 'Gratitude', new.gratitude),
      ('thoughts', 'Anything else', new.thoughts),
      ('god_note', 'With God', new.god_note),
      ('mood_note', 'Mood', new.mood_note),
      ('stress_note', 'Stress', new.stress_note)
    ) as t(field, label, body)
  loop
    if f.body is not null and f.body ~* v_pattern then
      insert into public.love_mentions (pair_id, author, journal_date, field, label, body)
      values (v_pair, new.user_id, new.date, f.field, f.label, f.body)
      on conflict (author, journal_date, field) do update
        set body = excluded.body, pair_id = excluded.pair_id, updated_at = now()
        where public.love_mentions.body is distinct from excluded.body;
    else
      delete from public.love_mentions
      where author = new.user_id and journal_date = new.date and field = f.field;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.love_journal_mentions() from public, anon, authenticated;

create or replace trigger journal_love_mentions after insert or update on public.journal_entries
  for each row execute function public.love_journal_mentions();

-- ---------------------------------------------------------------------------
-- Quotes: a copy on their Board
-- ---------------------------------------------------------------------------

create or replace function public.love_send_quote(p_quote uuid, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_pair uuid := public.love_pair_of(auth.uid());
  v_to uuid := public.love_partner_of(auth.uid());
  q public.quotes%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_id uuid;
  v_copy uuid;
begin
  if v_pair is null or v_to is null then raise exception 'You''re not paired yet.'; end if;
  select * into q from public.quotes where id = p_quote and user_id = v_me;
  if not found then raise exception 'That quote isn''t yours to send.'; end if;

  insert into public.love_quotes (pair_id, sender, text, author, source, image_url, note)
  values (v_pair, v_me, q.text, q.author, q.source, q.image_url, left(v_note, 500))
  returning id into v_id;

  insert into public.quotes (user_id, text, author, author_kind, source, source_url, year, verified,
    image_url, image_credit, image_page, origin, pick_reason, saved_at, love_quote_id)
  values (v_to, q.text, q.author, q.author_kind, q.source, q.source_url, q.year, q.verified,
    q.image_url, q.image_credit, q.image_page, 'pick',
    left('From ' || public.love_name(v_pair, v_me) || coalesce(': ' || v_note, ''), 500), now(), v_id)
  returning id into v_copy;

  update public.love_quotes set copy_id = v_copy where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.love_send_quote(uuid, text) from public, anon;
grant execute on function public.love_send_quote(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Planned dates on both schedules
-- ---------------------------------------------------------------------------

-- A date with a day and a time is a block on both people's schedules, in
-- step with the date: moved, renamed, or taken off when it goes back to
-- being an idea or loses its time. Done dates keep their block.
create or replace function public.love_dates_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m record;
begin
  if new.on_date is null or new.start_time is null or new.status = 'idea' then
    delete from public.time_chunks where love_date_id = new.id;
    return null;
  end if;
  for m in select user_id from public.love_members where pair_id = new.pair_id loop
    update public.time_chunks
      set date = new.on_date, start_time = new.start_time, end_time = new.end_time, title = new.title
      where love_date_id = new.id and user_id = m.user_id;
    if not found then
      insert into public.time_chunks (user_id, date, start_time, end_time, title, source, color, love_date_id, notes)
      values (m.user_id, new.on_date, new.start_time, new.end_time, new.title, 'manual', 'brick', new.id, new.place);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.love_dates_sync() from public, anon, authenticated;

create or replace trigger love_dates_schedule after insert or update of status, on_date, start_time, end_time, title on public.love_dates
  for each row execute function public.love_dates_sync();

-- ---------------------------------------------------------------------------
-- Push
-- ---------------------------------------------------------------------------

-- Each minute: if any alert has waited a minute and its person has a phone
-- to push to, hand the batch to the love-push function.
create or replace function public.love_push_tick()
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_secret text;
begin
  -- Nobody to push to: mark them so they aren't looked at again.
  update public.love_alerts a set pushed_at = now()
  where a.pushed_at is null
    and a.created_at < now() - interval '1 minute'
    and not exists (select 1 from public.push_subscriptions s where s.user_id = a.recipient and s.failed_at is null);

  if not exists (
    select 1 from public.love_alerts
    where pushed_at is null and created_at < now() - interval '1 minute'
  ) then
    return;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'curator_cron_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/love-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.love_push_tick() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'love-push') then
    perform cron.schedule('love-push', '* * * * *', $cron$ select public.love_push_tick(); $cron$);
  end if;
end $$;
