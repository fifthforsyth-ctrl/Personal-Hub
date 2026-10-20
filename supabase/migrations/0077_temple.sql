-- Temple: family history and temple work for Aaron's ancestors.
--
-- FamilySearch is the source of truth. The Hub keeps a mirror of what the
-- last FamilySearch snapshot said, and only Aaron's own planning on top:
--
--   temple_people       everyone in the 9-generation pedigree (ahnentafel
--                       numbers: 1 = Aaron, 2 = father, 3 = mother ...)
--   temple_ordinances   each open ordinance, with FamilySearch's raw status
--                       and its reasons when it isn't ready. The Hub never
--                       decides eligibility; it only sorts and batches
--   temple_done         people whose ordinances Aaron reserved and are now
--                       completed (FamilySearch keeps the last 2 years), each
--                       with [{type, date, temple}]
--   temple_syncs        one row per snapshot loaded, with its counts
--   temple_trips        trips he plans: a type, a date and the names on it.
--                       A trip is done when none of its names are still open
--   temple_helpers      women in the family who take women's names
--   temple_permissions  the 110-year rule: who gave permission, and when
--
-- The mirror tables are replaced wholesale by each snapshot, from the app.
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop table if exists public.temple_permissions, public.temple_helpers, public.temple_trips,
--     public.temple_syncs, public.temple_done, public.temple_ordinances, public.temple_people;

create table if not exists public.temple_people (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pid text not null check (length(pid) between 3 and 20),
  name text not null,
  gender text not null default 'U' check (gender in ('M', 'F', 'U')),
  lifespan text,
  ahnentafel integer,
  generation integer,
  birth_place text,
  death_place text,
  -- FamilySearch's rollup: COMPLETED, READY, RESERVED, NEEDS_MORE_INFORMATION, LIVING ...
  rollup_status text,
  synced_at timestamptz not null default now(),
  primary key (user_id, pid)
);

create table if not exists public.temple_ordinances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pid text not null,
  kind text not null check (kind in ('bap', 'con', 'ini', 'end', 'stp', 'sts')),
  -- Sealings to a spouse only; '' otherwise, so the natural key is unique.
  spouse_name text not null default '',
  -- Raw FamilySearch status: Ready, NeedsMoreInformation, NeedsPermission,
  -- InProgressNotPrinted, ReservedSharedReady, SharedInProgressNotPrinted ...
  fs_status text not null,
  reasons text[] not null default '{}',
  synced_at timestamptz not null default now(),
  unique (user_id, pid, kind, spouse_name)
);

create index if not exists temple_ordinances_user on public.temple_ordinances (user_id);

create table if not exists public.temple_done (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pid text not null,
  name text not null,
  gender text not null default 'U' check (gender in ('M', 'F', 'U')),
  lifespan text,
  in_pedigree boolean not null default false,
  ordinances jsonb not null default '[]',
  synced_at timestamptz not null default now(),
  primary key (user_id, pid)
);

create table if not exists public.temple_syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- When FamilySearch was read, as the snapshot says.
  synced_at timestamptz not null,
  loaded_at timestamptz not null default now(),
  counts jsonb not null default '{}'
);

create index if not exists temple_syncs_user on public.temple_syncs (user_id, synced_at desc);

create table if not exists public.temple_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bap', 'ini', 'end', 'seal')),
  planned_on date not null,
  -- [{pid, name, kind, spouse}] in the order the queue put them.
  items jsonb not null default '[]',
  rechecked_on date,
  printed boolean not null default false,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists temple_trips_user on public.temple_trips (user_id, planned_on);

create table if not exists public.temple_helpers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  note text check (note is null or length(note) <= 500),
  per_trip integer not null default 5 check (per_trip between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.temple_permissions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pid text not null,
  granted_by text not null check (length(btrim(granted_by)) between 1 and 120),
  relationship text check (relationship is null or length(relationship) <= 80),
  granted_on date not null,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, pid)
);

alter table public.temple_people enable row level security;
alter table public.temple_ordinances enable row level security;
alter table public.temple_done enable row level security;
alter table public.temple_syncs enable row level security;
alter table public.temple_trips enable row level security;
alter table public.temple_helpers enable row level security;
alter table public.temple_permissions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['temple_people', 'temple_ordinances', 'temple_done', 'temple_syncs',
                           'temple_trips', 'temple_helpers', 'temple_permissions'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'Own rows') then
      execute format(
        'create policy "Own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
        t
      );
    end if;
  end loop;
end $$;

revoke all on public.temple_people, public.temple_ordinances, public.temple_done, public.temple_syncs,
  public.temple_trips, public.temple_helpers, public.temple_permissions from anon, public;

grant select, insert, update, delete on public.temple_people, public.temple_ordinances, public.temple_done,
  public.temple_syncs, public.temple_trips, public.temple_helpers, public.temple_permissions to authenticated;
