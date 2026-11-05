-- Focus mode on a timer.
--
-- Any timer can be put in focus mode with a checkbox: while it's ticked you
-- are expected to give the task in front of you your full attention. Focus
-- ends when the box is unticked or the timer stops, whichever comes first.
-- While it runs, two things can break it, and both are written down:
--
--   pulled  something took your attention at the desk (phone, a text, a
--           site, a thought). A mark in time with a reason; focus goes on.
--   left    you left the office, and why. Focus is paused from then until
--           you tap Back to work (ended_at).
--
--   focus_mode_spans   one row per stretch of focus on a timer
--   focus_mode_breaks  what broke it: kind, reason, a line, when
--
-- A timer can be stopped from anywhere (the Hub, the watch, Going to bed, a
-- runaway fix), so a trigger closes its open focus, and any time out of the
-- office still open, at the moment the timer ended.
--
-- These are new names on purpose: "focus" elsewhere means the weekly focus
-- goals (focus_goals, focus_notes, focus_checks), which this doesn't touch.
--
-- Purely additive.
--
-- Rollback (SQL Editor; removes only what this file added):
--   drop trigger if exists time_log_entries_close_focus on public.time_log_entries;
--   drop function if exists public.close_focus_on_stop();
--   drop table if exists public.focus_mode_breaks;
--   drop table if exists public.focus_mode_spans;

create table if not exists public.focus_mode_spans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id uuid not null references public.time_log_entries(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- 'off' when the box was unticked, 'timer' when the timer stopped.
  ended_by text check (ended_by in ('off', 'timer')),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- One focus at a time on a timer.
create unique index if not exists focus_mode_spans_one_open on public.focus_mode_spans (entry_id) where ended_at is null;
create index if not exists focus_mode_spans_user_started on public.focus_mode_spans (user_id, started_at desc);

create table if not exists public.focus_mode_breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  span_id uuid not null references public.focus_mode_spans(id) on delete cascade,
  kind text not null check (kind in ('pulled', 'left')),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 80),
  note text check (note is null or char_length(note) <= 1000),
  started_at timestamptz not null default now(),
  -- Back to work, for time out of the office. A pull is only a moment.
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'left' or ended_at is null),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists focus_mode_breaks_span on public.focus_mode_breaks (span_id, started_at);
create index if not exists focus_mode_breaks_user_started on public.focus_mode_breaks (user_id, started_at desc);

alter table public.focus_mode_spans enable row level security;
alter table public.focus_mode_breaks enable row level security;

-- Your own rows, on your own timer and your own focus: the ids are
-- guessable, so the policies check rather than trust them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_mode_spans' and policyname = 'Own focus mode spans') then
    create policy "Own focus mode spans" on public.focus_mode_spans
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.time_log_entries e where e.id = entry_id and e.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'focus_mode_breaks' and policyname = 'Own focus mode breaks') then
    create policy "Own focus mode breaks" on public.focus_mode_breaks
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.focus_mode_spans s where s.id = span_id and s.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.focus_mode_spans from anon, public;
revoke all on public.focus_mode_breaks from anon, public;
grant select, insert, update, delete on public.focus_mode_spans to authenticated;
grant select, insert, update, delete on public.focus_mode_breaks to authenticated;

-- When a timer stops, its focus stops with it, and so does any time out of
-- the office still open on it. Runs as the one who stopped the timer (the
-- owner, or the service role for the watch), so it only ever touches the
-- timer's own rows.
create or replace function public.close_focus_on_stop()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ended_at is not null and (old.ended_at is null or old.ended_at is distinct from new.ended_at) then
    update public.focus_mode_breaks b
       set ended_at = greatest(b.started_at, new.ended_at)
      from public.focus_mode_spans s
     where b.span_id = s.id
       and s.entry_id = new.id
       and b.kind = 'left'
       and b.ended_at is null;
    update public.focus_mode_spans
       set ended_at = greatest(started_at, new.ended_at),
           ended_by = 'timer'
     where entry_id = new.id
       and ended_at is null;
  end if;
  return new;
end
$$;

drop trigger if exists time_log_entries_close_focus on public.time_log_entries;
create trigger time_log_entries_close_focus
  after update of ended_at on public.time_log_entries
  for each row execute function public.close_focus_on_stop();
