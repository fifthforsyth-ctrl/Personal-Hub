-- Apple Watch: buttons on the wrist, and what the watch measures.
--
-- The Hub can't run on the watch, so two things talk to it for you, both
-- through the `watch` edge function:
--
--   * A Shortcut on the watch ("Hub"): win, loss, start or stop a timer,
--     tick a Today task, say a note. It writes the same rows the app does.
--   * The iPhone: a wake-up automation (the moment you're up, for Wake
--     watch) and Health Auto Export, which sends sleep, workouts and the
--     day's numbers (steps, heart, mindful minutes...) from Apple Health.
--
-- Neither can sign in, so they carry a key, made in the app (More > On
-- your watch) the same way the widget's is: only its SHA-256 is kept, it's
-- shown once, and making a new one turns the old one off.
--
--   watch_keys       one key per person (hash only)
--   new_watch_key()  makes or replaces your key and returns it, once
--   health_days      one row per day: sleep, steps, heart, mindful minutes...
--   health_workouts  one row per workout, linked to the Exercise entry made
--                    for it in the minutes log
--   health_imports   the last few things the iPhone sent, as they came, so a
--                    metric that doesn't land can be looked at and fixed
--   time_log_entries.source  'watch' when the watch made the entry (a timer
--                    started from the wrist, a night of sleep, a workout)
--
-- Nothing here scores anything or makes a win by itself.
--
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   alter table public.time_log_entries drop column if exists source;
--   drop function if exists public.new_watch_key();
--   drop table if exists public.health_imports;
--   drop table if exists public.health_workouts;
--   drop table if exists public.health_days;
--   drop table if exists public.watch_keys;

create table if not exists public.watch_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- What last used it: 'shortcut', 'wake' or 'health'.
  last_used_by text
);

alter table public.watch_keys enable row level security;
create policy "watch_keys_select_own" on public.watch_keys
  for select to authenticated using (auth.uid() = user_id);
create policy "watch_keys_delete_own" on public.watch_keys
  for delete to authenticated using (auth.uid() = user_id);
grant select, delete on public.watch_keys to authenticated;

create or replace function public.new_watch_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  k := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.watch_keys (user_id, key_hash)
  values (auth.uid(), encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, created_at = now(), last_used_at = null, last_used_by = null;
  return k;
end;
$$;

revoke all on function public.new_watch_key() from public, anon;
grant execute on function public.new_watch_key() to authenticated;

-- One row per day (the day you woke up on, for sleep). Every number is
-- optional: a day has whatever the watch measured.
create table if not exists public.health_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  -- Sleep for the night that ended this morning.
  sleep_start timestamptz,
  sleep_end timestamptz,
  asleep_min numeric,
  deep_min numeric,
  rem_min numeric,
  core_min numeric,
  awake_min numeric,
  in_bed_min numeric,
  -- The day.
  steps integer,
  active_kcal numeric,
  exercise_min numeric,
  stand_hours numeric,
  daylight_min numeric,
  mindful_min numeric,
  distance_mi numeric,
  flights integer,
  -- Heart and body.
  resting_hr numeric,
  hrv_ms numeric,
  avg_hr numeric,
  respiratory_rate numeric,
  wrist_temp_c numeric,
  spo2_pct numeric,
  vo2max numeric,
  caffeine_mg numeric,
  weight_lb numeric,
  -- Anything else that came, by Health Auto Export's name.
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.health_days enable row level security;
create policy "health_days_own" on public.health_days
  for select to authenticated using (auth.uid() = user_id);
create policy "health_days_delete_own" on public.health_days
  for delete to authenticated using (auth.uid() = user_id);
grant select, delete on public.health_days to authenticated;

create table if not exists public.health_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The workout's own id from Apple Health (or its start time), so the
  -- same workout sent twice lands once.
  external_id text not null,
  name text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes numeric not null,
  active_kcal numeric,
  avg_hr numeric,
  max_hr numeric,
  distance numeric,
  distance_unit text,
  time_entry_id uuid references public.time_log_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists health_workouts_user_start on public.health_workouts (user_id, started_at desc);

alter table public.health_workouts enable row level security;
create policy "health_workouts_own" on public.health_workouts
  for select to authenticated using (auth.uid() = user_id);
create policy "health_workouts_delete_own" on public.health_workouts
  for delete to authenticated using (auth.uid() = user_id);
grant select, delete on public.health_workouts to authenticated;

create table if not exists public.health_imports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  received_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  payload jsonb
);

create index if not exists health_imports_user_time on public.health_imports (user_id, received_at desc);

alter table public.health_imports enable row level security;
create policy "health_imports_own" on public.health_imports
  for select to authenticated using (auth.uid() = user_id);
grant select on public.health_imports to authenticated;

alter table public.time_log_entries
  add column if not exists source text check (source is null or source = 'watch');
