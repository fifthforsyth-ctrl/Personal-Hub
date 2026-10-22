-- The village: what each quest builds.
--
-- Aaron, 2026-10-22: quest work isn't a straight climb, so each quest also
-- builds something in a village that grows as he works. A quest builds a
-- whole building (a fortress, an outpost, a farm), each camp builds one of
-- its parts, and each step he ticks lays a few bricks. He doesn't pick the
-- building: once a quest's steps are laid out he taps Generate project and
-- chooses one of three builds sized to it. Everything else (which parts are
-- standing, how many bricks are down) comes from the steps themselves, so
-- the only thing kept is the choice.
--
--   quest_id  the quest (or a lesson's own mountain) the build belongs to;
--             one build per quest
--   kind      which build: fortress, warcamp, farmstead, windmill, farm,
--             outpost, cottage, forge, well or watchtower
--   seed      the variation he picked, so it draws the same every time
--   plot      which plot of land it stands on, in the order plots are
--             handed out around the plaza (0 is the first)
--
-- Additive only: one new table. To undo it, remove the table in the SQL
-- Editor; nothing else points at it.

create table if not exists public.village_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  kind text not null check (kind in ('fortress', 'warcamp', 'farmstead', 'windmill', 'farm', 'outpost', 'cottage', 'forge', 'well', 'watchtower')),
  seed integer not null default 1,
  plot integer not null check (plot >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists village_builds_quest on public.village_builds (quest_id);
create unique index if not exists village_builds_plot on public.village_builds (user_id, plot);

alter table public.village_builds enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'village_builds' and policyname = 'Own village builds') then
    create policy "Own village builds" on public.village_builds
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.village_builds from anon, public;
grant select, insert, update, delete on public.village_builds to authenticated;
