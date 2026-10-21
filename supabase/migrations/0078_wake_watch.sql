-- Wake watch: peers hear each morning whether you got up.
--
-- At 4:35 on your clock, if you're already up, your peers get "Aaron is
-- successfully up and fighting dragons". If you're still asleep nothing goes
-- yet, because the wake time isn't known: the dragons text goes the minute
-- you're up, with the time in it. Nothing logged by 9:00 sends the dragons
-- text without a time.
--
-- "Up" is the first sign of it after 2:00 that morning, whichever comes
-- first: a night's Sleep timer stopping ("I'm up"), any other timer
-- starting, or the woke time in the morning check-in. It counts as up at
-- 4:35 only if that moment is on or before 4:35. A Sleep timer that stops
-- and starts again within half an hour (up in the night, back to bed)
-- doesn't count.
--
--   wake_watch      your settings, one row
--     enabled       watching at all
--     live          false = practice: every morning is judged and written
--                   down, but no text goes to anyone
--     check_at      when the verdict is due (4:35)
--     give_up_at    when silence becomes the dragons text (9:00)
--     tz            your clock
--     days          which days of the week (0 = Sunday)
--     up_text, late_text, unlogged_text
--                   the three messages; {time} becomes the wake time
--     enabled_at    mornings before this are never judged, so turning it on
--                   at noon doesn't text anyone about this morning
--   wake_peers      who gets the text (name, phone in +1XXXXXXXXXX form)
--   wake_reports    one row per morning: the verdict, the message, and
--                   whether it went
--
--   wake_watch_tick()   run each minute by pg_cron in the morning window; it
--                       judges, writes the report, and asks the `wake` edge
--                       function to send queued ones
--   wake_time(user, date, tz)   the first sign of being up that morning
--
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   select cron.unschedule('wake-watch');
--   drop function if exists public.wake_watch_tick(), public.trigger_wake_send(uuid),
--     public.wake_time(uuid, date, text), public.wake_watch_stamp();
--   drop table if exists public.wake_reports, public.wake_peers, public.wake_watch;

create table if not exists public.wake_watch (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  live boolean not null default false,
  check_at time not null default '04:35',
  give_up_at time not null default '09:00',
  tz text not null default 'America/Denver',
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  up_text text not null default 'Aaron is successfully up and fighting dragons'
    check (length(btrim(up_text)) between 1 and 300),
  late_text text not null default 'The sleep dragons have defeated Aaron--he woke up at {time}'
    check (length(btrim(late_text)) between 1 and 300),
  unlogged_text text not null default 'The sleep dragons have defeated Aaron--he hasn''t logged waking up yet'
    check (length(btrim(unlogged_text)) between 1 and 300),
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint wake_watch_order check (give_up_at > check_at),
  constraint wake_watch_days check (days <@ '{0,1,2,3,4,5,6}'::smallint[])
);

create table if not exists public.wake_peers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);

create index if not exists wake_peers_user on public.wake_peers (user_id);

create table if not exists public.wake_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The morning, on your clock.
  date date not null,
  -- waiting: 4:35 passed and you weren't up; the rest are final.
  outcome text not null check (outcome in ('waiting', 'up', 'late', 'unlogged')),
  woke_at timestamptz,
  message text,
  -- practice: judged with live off, nothing sent. queued: handed to the
  -- edge function. sent / failed: what came back. none: no active peers.
  status text not null default 'waiting'
    check (status in ('waiting', 'practice', 'queued', 'sent', 'failed', 'none')),
  sent_to integer not null default 0,
  error text,
  decided_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.wake_watch enable row level security;
alter table public.wake_peers enable row level security;
alter table public.wake_reports enable row level security;

create policy "wake_watch_own" on public.wake_watch
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "wake_peers_own" on public.wake_peers
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Reports are written only by the tick and the edge function.
create policy "wake_reports_select_own" on public.wake_reports
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.wake_watch, public.wake_peers, public.wake_reports from anon, public;
grant select, insert, update on public.wake_watch to authenticated;
grant select, insert, update, delete on public.wake_peers to authenticated;
grant select on public.wake_reports to authenticated;

-- Turning it on stamps enabled_at, so only mornings after that are judged.
create or replace function public.wake_watch_stamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.enabled and (tg_op = 'INSERT' or not old.enabled) then
    new.enabled_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger wake_watch_stamp before insert or update on public.wake_watch
  for each row execute function public.wake_watch_stamp();

-- The first sign of being up on a morning, between 2:00 and noon.
create or replace function public.wake_time(p_user uuid, p_date date, p_tz text)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with w as (
    select (p_date + time '02:00') at time zone p_tz as lo,
           (p_date + time '12:00') at time zone p_tz as hi
  )
  select min(t) from (
    select e.ended_at as t
    from public.time_log_entries e, w
    where e.user_id = p_user
      and (e.tags @> array['Sleep'] or e.category = 'Sleep')
      and e.ended_at >= w.lo and e.ended_at < w.hi
      and e.started_at < e.ended_at
      -- Up at 3:00 and back to bed by 3:30 isn't waking up.
      and not exists (
        select 1 from public.time_log_entries b
        where b.user_id = p_user and b.id <> e.id
          and (b.tags @> array['Sleep'] or b.category = 'Sleep')
          and b.started_at >= e.ended_at and b.started_at < e.ended_at + interval '30 minutes'
          and b.started_at <= now()
      )
    union all
    select e.started_at
    from public.time_log_entries e, w
    where e.user_id = p_user
      and not (coalesce(e.tags, '{}') @> array['Sleep'] or e.category = 'Sleep')
      and e.started_at >= w.lo and e.started_at < w.hi
    union all
    select d.woke_at
    from public.day_plans d, w
    where d.user_id = p_user and d.date = p_date
      and d.woke_at >= w.lo and d.woke_at < w.hi
  ) s;
$$;

revoke all on function public.wake_time(uuid, date, text) from public, anon, authenticated;

-- Hands one queued report to the `wake` edge function.
create or replace function public.trigger_wake_send(p_report uuid)
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
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'curator_cron_secret';
  if v_secret is null then
    raise exception 'curator_cron_secret is not in the vault.';
  end if;
  select net.http_post(
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/wake',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('report_id', p_report),
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.trigger_wake_send(uuid) from public, anon, authenticated;

create or replace function public.wake_watch_tick()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wake_watch%rowtype;
  r public.wake_reports%rowtype;
  v_date date;
  v_check timestamptz;
  v_give_up timestamptz;
  v_woke timestamptz;
  v_outcome text;
  v_message text;
  v_status text;
  v_peers integer;
begin
  for w in select * from public.wake_watch where enabled loop
    v_date := (now() at time zone w.tz)::date;
    v_check := (v_date + w.check_at) at time zone w.tz;
    v_give_up := (v_date + w.give_up_at) at time zone w.tz;

    continue when now() < v_check;
    continue when w.enabled_at is null or w.enabled_at > v_check;
    continue when not (extract(dow from v_date)::smallint = any (w.days));

    select * into r from public.wake_reports where user_id = w.user_id and date = v_date;
    continue when found and r.outcome <> 'waiting';

    v_woke := public.wake_time(w.user_id, v_date, w.tz);
    v_outcome := case
      when v_woke is not null and v_woke <= v_check and r.id is null then 'up'
      when v_woke is not null then 'late'
      when now() >= v_give_up then 'unlogged'
      else 'waiting'
    end;

    if v_outcome = 'waiting' then
      if r.id is null then
        insert into public.wake_reports (user_id, date, outcome, status)
        values (w.user_id, v_date, 'waiting', 'waiting')
        on conflict (user_id, date) do nothing;
      end if;
      continue;
    end if;

    v_message := case v_outcome
      when 'up' then w.up_text
      when 'late' then replace(w.late_text, '{time}',
        ltrim(to_char(v_woke at time zone w.tz, 'HH12:MI'), '0') ||
        lower(to_char(v_woke at time zone w.tz, ' AM')))
      else w.unlogged_text
    end;

    select count(*) into v_peers from public.wake_peers where user_id = w.user_id and active;
    v_status := case when not w.live then 'practice' when v_peers = 0 then 'none' else 'queued' end;

    insert into public.wake_reports (user_id, date, outcome, woke_at, message, status, decided_at)
    values (w.user_id, v_date, v_outcome, v_woke, v_message, v_status, now())
    on conflict (user_id, date) do update
      set outcome = excluded.outcome, woke_at = excluded.woke_at, message = excluded.message,
          status = excluded.status, decided_at = excluded.decided_at
      where public.wake_reports.outcome = 'waiting'
    returning * into r;

    if r.id is not null and r.status = 'queued' then
      perform public.trigger_wake_send(r.id);
    end if;
  end loop;
end;
$$;

revoke all on function public.wake_watch_tick() from public, anon, authenticated;

-- Every minute from 9:00 to 17:59 UTC: 4:35 and 9:00 in Denver in both
-- summer and winter time, and every minute in between, so a late wake-up
-- goes out within a minute of "I'm up".
select cron.schedule('wake-watch', '* 9-17 * * *', $$ select public.wake_watch_tick(); $$);
