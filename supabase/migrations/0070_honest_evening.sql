-- Honest tracking, tier 2: the evening check-in.
--
-- New columns on day_plans that start empty; nothing already recorded is
-- changed.
--
--   mood 1–5 and stress 1–5, with stress_source (the main source, from
--   chips you can extend), off_plan_reason (why the day went off plan,
--   asked only when planned blocks were missed), had_prompting (false when
--   the evening's answer was "no prompting today"; a yes is written to
--   spiritual_experiences as well).
--
-- Tomorrow's alarm needs no new column: the evening writes it into
-- tomorrow's day_plans.alarm_at (added in 0069), and the morning confirms it.
-- The prayer line writes a prayer_logs row with context 'Evening'.
--
-- Rollback (run in the SQL Editor; drops only what this file added):
--   alter table public.day_plans drop column if exists mood, drop column if exists stress,
--     drop column if exists stress_source, drop column if exists off_plan_reason,
--     drop column if exists had_prompting;

alter table public.day_plans
  add column if not exists mood smallint check (mood between 1 and 5),
  add column if not exists stress smallint check (stress between 1 and 5),
  add column if not exists stress_source text check (stress_source is null or length(btrim(stress_source)) between 1 and 60),
  add column if not exists off_plan_reason text check (off_plan_reason is null or length(btrim(off_plan_reason)) between 1 and 300),
  add column if not exists had_prompting boolean;

comment on column public.day_plans.mood is 'Evening mood, 1 (low) to 5 (high). Null means not answered.';
comment on column public.day_plans.stress is 'Evening stress, 1 (calm) to 5 (very stressed). Null means not answered.';
comment on column public.day_plans.stress_source is 'Main source of the day''s stress, from chips (Work, Money, Family…) or typed.';
comment on column public.day_plans.off_plan_reason is 'Why the day went off plan; asked only when planned blocks were missed.';
comment on column public.day_plans.had_prompting is 'Evening answer to "any prompting today?". true also writes a spiritual_experiences row.';
