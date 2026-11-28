-- Board collections (Aaron, 2026-11-22/27).
--
-- Everything he kept sat on one long board and never came back to him. Now
-- he names collections ("Closer to Christ", "Show up and work") and files
-- quotes and thoughts into them; a quote or a thought can sit in more than
-- one. A collection marked `feeds_today` lends its quotes to the Board's
-- "Today, from …" draw.
--
-- New saves wait in a "To sort" tray until he files them or keeps them
-- loose. The tray is the saved quotes with no `filed_at`: filing a quote, or
-- keeping it loose, stamps it.
--
-- `quote_collections` (0063) is the AI's shelves, so these are new tables.
-- Additive only: two tables and one nullable column, nothing dropped.

create table if not exists public.board_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  feeds_today boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_collections_user on public.board_collections (user_id, position);

create table if not exists public.board_collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection_id uuid not null references public.board_collections(id) on delete cascade,
  -- Exactly one: a saved quote, or one of his own thoughts.
  quote_id uuid references public.quotes(id) on delete cascade,
  note_id uuid references public.study_notes(id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  constraint board_collection_items_one check (num_nonnulls(quote_id, note_id) = 1)
);

-- Once per collection. The app inserts and reads 23505 as "already in it".
create unique index if not exists board_collection_items_once
  on public.board_collection_items (collection_id, coalesce(quote_id, note_id));
create index if not exists board_collection_items_user on public.board_collection_items (user_id);
create index if not exists board_collection_items_quote on public.board_collection_items (quote_id) where quote_id is not null;
create index if not exists board_collection_items_note on public.board_collection_items (note_id) where note_id is not null;

alter table public.quotes add column if not exists filed_at timestamptz;
comment on column public.quotes.filed_at is
  'When a saved quote left the Board''s To sort tray: filed into a collection, or kept loose.';

alter table public.board_collections enable row level security;
alter table public.board_collection_items enable row level security;

-- Your own rows, and only into your own collection with your own quote or
-- thought: the ids are guessable, so the policy checks (as in 0104).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'board_collections' and policyname = 'Own board collections') then
    create policy "Own board collections" on public.board_collections
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'board_collection_items' and policyname = 'Own board collection items') then
    create policy "Own board collection items" on public.board_collection_items
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.board_collections c where c.id = collection_id and c.user_id = auth.uid())
        and (quote_id is null or exists (select 1 from public.quotes x where x.id = quote_id and x.user_id = auth.uid()))
        and (note_id is null or exists (select 1 from public.study_notes s where s.id = note_id and s.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.board_collections from anon, public;
revoke all on public.board_collection_items from anon, public;
grant select, insert, update, delete on public.board_collections to authenticated;
grant select, insert, update, delete on public.board_collection_items to authenticated;
