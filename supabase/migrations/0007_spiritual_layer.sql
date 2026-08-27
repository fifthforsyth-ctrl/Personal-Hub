-- Phase 4 — Spiritual layer (Section 4.4 of the vision doc).
--
-- Three tables, and the reason each is separate:
--   spiritual_experiences — promptings kept apart from the daily journal, with
--     an explicit acted-on / follow-up loop. That loop is what turns a diary
--     into a dataset you can see revelation patterns in: an experience with
--     no follow-up is an OPEN LOOP the app brings back to you, rather than a
--     line that scrolls away.
--   study_notes — what was studied, either typed here or pushed from the
--     Obsidian vault, with room for a distilled theme/key points alongside
--     (never instead of) the full original text.
--   scripture_refs — one row per verse reference found in any of the above,
--     so tagging a verse can surface every prayer, prompting, and note that
--     ever touched it.
--
-- Same strictly-private RLS as the rest of the schema.

create type public.experience_kind as enum (
  'prompting', 'impression', 'answer', 'tender_mercy', 'comfort', 'warning', 'insight'
);

create table public.spiritual_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind public.experience_kind not null default 'prompting',
  what_came text not null,
  trigger_context text,
  acted_on boolean not null default false,
  acted_on_at timestamptz,
  action_taken text,
  follow_up_notes text,
  linked_goal_id uuid references public.nodes(id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spiritual_experiences_user_idx on public.spiritual_experiences(user_id, occurred_at desc);
create index spiritual_experiences_open_idx on public.spiritual_experiences(user_id, acted_on) where acted_on = false;

alter table public.spiritual_experiences enable row level security;

create policy "own spiritual experiences" on public.spiritual_experiences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create type public.study_source as enum ('scripture', 'conference', 'come_follow_me', 'other');

create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  source_kind public.study_source not null default 'other',
  source_ref text,
  studied_on date not null default current_date,
  linked_goal_id uuid references public.nodes(id) on delete set null,
  tags text[] not null default '{}',

  -- Obsidian provenance. obsidian_uid is the vault-relative path, so a
  -- re-sync of an edited note updates in place instead of duplicating.
  obsidian_uid text,
  obsidian_path text,
  content_hash text,
  synced_at timestamptz,

  -- Distillation. Kept in its own columns alongside the untouched body —
  -- the original is the record, this is only a reading aid over it.
  ai_theme text,
  ai_summary text,
  ai_key_points jsonb,
  ai_model text,
  ai_processed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index study_notes_obsidian_uid_idx on public.study_notes(user_id, obsidian_uid) where obsidian_uid is not null;
create index study_notes_user_studied_idx on public.study_notes(user_id, studied_on desc);
create index study_notes_unprocessed_idx on public.study_notes(user_id) where ai_processed_at is null;

alter table public.study_notes enable row level security;

create policy "own study notes" on public.study_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.scripture_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('prayer', 'experience', 'study_note')),
  entity_id uuid not null,
  book text not null,
  chapter integer,
  verse_start integer,
  verse_end integer,
  raw_ref text not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, raw_ref)
);

create index scripture_refs_lookup_idx on public.scripture_refs(user_id, book, chapter);
create index scripture_refs_entity_idx on public.scripture_refs(entity_type, entity_id);

alter table public.scripture_refs enable row level security;

create policy "own scripture refs" on public.scripture_refs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "On this day" across every spiritual record — the doc's resurfacing, done
-- deterministically. Returns entries from the same calendar day in any
-- PRIOR year, newest first.
create function public.on_this_day(p_tz text default 'UTC')
returns table (
  source text,
  id uuid,
  occurred_at timestamptz,
  title text,
  body text
)
language sql
security definer
set search_path to 'public'
as $$
  with today as (
    select extract(month from (now() at time zone p_tz))::int as m,
           extract(day from (now() at time zone p_tz))::int as d,
           extract(year from (now() at time zone p_tz))::int as y
  )
  select 'experience', e.id, e.occurred_at, e.kind::text, e.what_came
  from public.spiritual_experiences e, today
  where e.user_id = auth.uid()
    and extract(month from (e.occurred_at at time zone p_tz)) = today.m
    and extract(day from (e.occurred_at at time zone p_tz)) = today.d
    and extract(year from (e.occurred_at at time zone p_tz)) < today.y
  union all
  select 'prayer', p.id, p.prayed_at, coalesce(p.context, 'Prayer'), p.content
  from public.prayer_logs p, today
  where p.user_id = auth.uid()
    and extract(month from (p.prayed_at at time zone p_tz)) = today.m
    and extract(day from (p.prayed_at at time zone p_tz)) = today.d
    and extract(year from (p.prayed_at at time zone p_tz)) < today.y
  union all
  select 'study_note', s.id, s.studied_on::timestamptz, s.title, coalesce(s.ai_summary, left(s.body, 400))
  from public.study_notes s, today
  where s.user_id = auth.uid()
    and extract(month from s.studied_on) = today.m
    and extract(day from s.studied_on) = today.d
    and extract(year from s.studied_on) < today.y
  order by occurred_at desc;
$$;

-- Everything that has ever referenced a given book (optionally a chapter) —
-- the cross-reference lookup. Joins back out to whichever table each ref
-- belongs to so one call returns readable results.
create function public.entries_for_scripture(p_book text, p_chapter integer default null)
returns table (
  source text,
  id uuid,
  occurred_at timestamptz,
  raw_ref text,
  title text,
  body text
)
language sql
security definer
set search_path to 'public'
as $$
  select r.entity_type,
         r.entity_id,
         case r.entity_type
           when 'experience' then e.occurred_at
           when 'prayer' then p.prayed_at
           else s.studied_on::timestamptz
         end,
         r.raw_ref,
         case r.entity_type
           when 'experience' then e.kind::text
           when 'prayer' then coalesce(p.context, 'Prayer')
           else s.title
         end,
         case r.entity_type
           when 'experience' then e.what_came
           when 'prayer' then p.content
           else coalesce(s.ai_summary, left(s.body, 400))
         end
  from public.scripture_refs r
  left join public.spiritual_experiences e on r.entity_type = 'experience' and e.id = r.entity_id
  left join public.prayer_logs p on r.entity_type = 'prayer' and p.id = r.entity_id
  left join public.study_notes s on r.entity_type = 'study_note' and s.id = r.entity_id
  where r.user_id = auth.uid()
    and lower(r.book) = lower(p_book)
    and (p_chapter is null or r.chapter = p_chapter)
  order by 3 desc nulls last;
$$;
