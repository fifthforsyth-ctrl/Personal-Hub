-- Today and the evening reflection.
--
-- Two things the redesign needs written down.
--
-- 1. The evening asks four questions now: where you saw God's hand, two that
--    are written fresh each night from the day itself (one toward the
--    Savior, one about what the day can teach), and an open card. A question
--    that changes nightly has to be kept with its answer — a banked day read
--    a year from now is meaningless as "yes, and I'll try harder" under no
--    question at all. The old q_christ / q_principles / q_success columns
--    stay: every day reflected before this keeps exactly what it said.
--
-- 2. The Walk with God card on Today is one verse and one prompt for the
--    day. It is generated once and kept, rather than on every open, because
--    a card that changes each time you glance at your phone stops being
--    something you carry through the day. A refresh overwrites the row.

alter table public.journal_entries
  add column if not exists gods_hand_nudge text,
  add column if not exists q_savior_prompt text,
  add column if not exists q_savior text,
  add column if not exists q_learn_prompt text,
  add column if not exists q_learn text;

create table if not exists public.daily_walk (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  verse_ref text not null,
  verse_text text not null,
  prompt text not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_walk enable row level security;

drop policy if exists "Own daily walk" on public.daily_walk;
create policy "Own daily walk" on public.daily_walk
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.daily_walk from anon;
