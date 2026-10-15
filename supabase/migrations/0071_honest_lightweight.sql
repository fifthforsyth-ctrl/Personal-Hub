-- Honest tracking, tier 3: the lightweight additions.
--
-- New columns that start empty, one new table, and one computed column.
-- Nothing already recorded is changed.
--
--   time_log_entries
--     is_nap          computed: a Sleep entry that started between 9 am and
--                     7 pm (Mountain time). Fills itself in for old entries
--                     too, since it's worked out from started_at.
--     exercise_kind   run / gym / other, asked when an Exercise timer stops
--     exercise_metric one optional number for it (miles, a weight, reps…)
--     exercise_unit   what that number is in ('mi', 'km', 'lb', 'reps', 'min')
--     alertness       alert / drowsy, asked when a Study timer stops
--     client          who the work was for, asked when a work timer stops
--   day_plans
--     shipped         "What I shipped": one line, top of the work report
--     sabbath_note    Sunday's one line about the Sabbath
--     fast_sunday     Sunday: was it a fast Sunday
--   tasks
--     left_reason     why an unfinished task was left, asked at close-out
--   bank_transactions
--     intent          planned / impulse, asked with "What was this?"
--     client          who a deposit came from
--   body_metrics (new)
--     weight now (from the "Weigh myself" win); steps and resting heart rate
--     later if a watch is connected.
--
-- Rollback (run in the SQL Editor; drops only what this file added):
--   drop table if exists public.body_metrics;
--   alter table public.time_log_entries drop column if exists is_nap, drop column if exists exercise_kind,
--     drop column if exists exercise_metric, drop column if exists exercise_unit,
--     drop column if exists alertness, drop column if exists client;
--   alter table public.day_plans drop column if exists shipped, drop column if exists sabbath_note,
--     drop column if exists fast_sunday;
--   alter table public.tasks drop column if exists left_reason;
--   alter table public.bank_transactions drop column if exists intent, drop column if exists client;

alter table public.time_log_entries
  add column if not exists is_nap boolean generated always as (
    (category = 'Sleep' or 'Sleep' = any(coalesce(tags, '{}'::text[])))
    and extract(hour from timezone('America/Denver', started_at)) between 9 and 18
  ) stored,
  add column if not exists exercise_kind text check (exercise_kind in ('run', 'gym', 'other')),
  add column if not exists exercise_metric numeric check (exercise_metric is null or exercise_metric > 0),
  add column if not exists exercise_unit text check (exercise_unit is null or length(btrim(exercise_unit)) between 1 and 12),
  add column if not exists alertness text check (alertness in ('alert', 'drowsy')),
  add column if not exists client text check (client is null or length(btrim(client)) between 1 and 60);

alter table public.day_plans
  add column if not exists shipped text check (shipped is null or length(btrim(shipped)) between 1 and 300),
  add column if not exists sabbath_note text check (sabbath_note is null or length(btrim(sabbath_note)) between 1 and 300),
  add column if not exists fast_sunday boolean;

alter table public.tasks
  add column if not exists left_reason text check (left_reason is null or length(btrim(left_reason)) between 1 and 80);

alter table public.bank_transactions
  add column if not exists intent text check (intent in ('planned', 'impulse')),
  add column if not exists client text check (client is null or length(btrim(client)) between 1 and 60);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  measured_at timestamptz not null default now(),
  kind text not null check (kind in ('weight', 'steps', 'resting_hr')),
  value numeric not null check (value > 0),
  unit text not null check (length(btrim(unit)) between 1 and 12),
  is_example boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists body_metrics_user_kind on public.body_metrics (user_id, kind, measured_at desc);
create index if not exists time_log_entries_user_client on public.time_log_entries (user_id, started_at desc) where client is not null;

alter table public.body_metrics enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'body_metrics' and policyname = 'Own body metrics') then
    create policy "Own body metrics" on public.body_metrics
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.body_metrics from anon, public;
grant select, insert, update, delete on public.body_metrics to authenticated;

comment on column public.time_log_entries.is_nap is 'Computed: a Sleep entry that started between 9:00 and 18:59 Mountain time.';
comment on column public.time_log_entries.exercise_kind is 'run, gym or other; asked when an Exercise timer stops. Morning vs afternoon comes from started_at.';
comment on column public.time_log_entries.exercise_metric is 'One optional number for the workout, in exercise_unit (miles for a run, a weight for the gym…).';
comment on column public.time_log_entries.alertness is 'Study: alert or drowsy, asked when a Study timer stops.';
comment on column public.time_log_entries.client is 'Work: who it was for (Parker, Scripture Central…), asked when a work timer stops.';
comment on column public.day_plans.shipped is '"What I shipped" today: one line, shown at the top of the work report.';
comment on column public.day_plans.sabbath_note is 'Sunday''s one line about the Sabbath, from the evening check-in.';
comment on column public.day_plans.fast_sunday is 'Sunday: true when it was a fast Sunday.';
comment on column public.tasks.left_reason is 'Why an unfinished task was left, picked at the evening close-out. Tasks never move to another day.';
comment on column public.bank_transactions.intent is 'planned or impulse, asked with the purchase question.';
comment on column public.bank_transactions.client is 'Who a deposit came from (Parker…), to compare earnings with hours.';
comment on table public.body_metrics is 'Body measurements: weight (from the Weigh myself win); steps and resting heart rate later.';
