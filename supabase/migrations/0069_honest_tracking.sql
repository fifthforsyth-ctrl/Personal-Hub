-- Honest tracking, tier 1: the morning check-in, misses with reasons, the
-- runaway-timer fix, and context on a stopped timer.
--
-- Everything here is new and optional: new columns that start empty, and
-- one new table. Nothing already recorded is changed.
--
-- day_plans (one row per day) gains the morning:
--   woke_at, lights_out_at (the night before this day), alarm_at,
--   sleep_quality 1–5, energy high|okay|low, snoozed,
--   phone_off_by_lights_out (last night), morning_at (check-in done).
--   energy is its own column: energy_tag already holds the Day page's day
--   type ("Deep focus", "Open day"…), a different question.
--
-- time_log_entries gains what a stop can say about the stretch:
--   depth deep|shallow and focus 1–5 (work), people[] and
--   people_feel draining|neutral|life_giving (people), split_from (the
--   entry a runaway timer was split from) and ended_by stop|bedtime|overnight_fix.
--
-- win_losses gains reason (why a loss happened, from chips you can extend)
-- and source ('checkin' for rows the morning check-in wrote, so editing the
-- check-in replaces its own rows and nothing else).
--
-- watched_habits: the habits being worked on, with the time they're due.
-- on_alarm ties a wake-up habit to the alarm it belongs to, so "Up at 4:30"
-- is only asked on 4:30 days.
--
-- Rollback (run in the SQL Editor; drops only what this file added):
--   drop table if exists public.watched_habits;
--   alter table public.win_losses drop column if exists reason, drop column if exists source;
--   alter table public.time_log_entries drop column if exists depth, drop column if exists focus,
--     drop column if exists people, drop column if exists people_feel,
--     drop column if exists split_from, drop column if exists ended_by;
--   alter table public.day_plans drop column if exists woke_at, drop column if exists lights_out_at,
--     drop column if exists alarm_at, drop column if exists sleep_quality, drop column if exists energy,
--     drop column if exists snoozed, drop column if exists phone_off_by_lights_out, drop column if exists morning_at;

alter table public.day_plans
  add column if not exists woke_at timestamptz,
  add column if not exists lights_out_at timestamptz,
  add column if not exists alarm_at time,
  add column if not exists sleep_quality smallint check (sleep_quality between 1 and 5),
  add column if not exists energy text check (energy in ('high', 'okay', 'low')),
  add column if not exists snoozed boolean,
  add column if not exists phone_off_by_lights_out boolean,
  add column if not exists morning_at timestamptz;

alter table public.time_log_entries
  add column if not exists depth text check (depth in ('deep', 'shallow')),
  add column if not exists focus smallint check (focus between 1 and 5),
  add column if not exists people text[],
  add column if not exists people_feel text check (people_feel in ('draining', 'neutral', 'life_giving')),
  add column if not exists split_from uuid references public.time_log_entries(id) on delete set null,
  add column if not exists ended_by text check (ended_by in ('stop', 'bedtime', 'overnight_fix'));

alter table public.win_losses
  add column if not exists reason text check (reason is null or length(btrim(reason)) between 1 and 60),
  add column if not exists source text check (source in ('checkin'));

create table if not exists public.watched_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  due_by time not null,
  on_alarm time,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists watched_habits_user on public.watched_habits (user_id, position);
create index if not exists win_losses_user_reason on public.win_losses (user_id, occurred_at desc) where reason is not null;
create index if not exists time_log_entries_user_people on public.time_log_entries (user_id, started_at desc) where people is not null;

alter table public.watched_habits enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watched_habits' and policyname = 'Own watched habits') then
    create policy "Own watched habits" on public.watched_habits
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.watched_habits from anon, public;
grant select, insert, update, delete on public.watched_habits to authenticated;

comment on column public.day_plans.lights_out_at is 'When the night before this day''s sleep began (from the Sleep timer, or set in the morning check-in).';
comment on column public.day_plans.energy is 'Morning energy: high, okay or low. Separate from energy_tag, which is the Day page''s day type.';
comment on column public.win_losses.source is 'checkin = written by the morning check-in; null = tapped by hand.';
