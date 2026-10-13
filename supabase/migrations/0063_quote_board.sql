-- Quotes on the cork board.
--
-- Until now a quote came one a day. This lets the Board hold quotes too:
--
--   * Any quote can be saved to the board (saved_at), where it's pinned up
--     beside your own thoughts.
--   * The Board opens on "top picks" for the week and on shelves you can
--     browse: by person, by theme, by mood, or anything you ask for. Each
--     shelf is a quote_collections row the `quotes` function fills in the
--     background, so opening one doesn't hang on a web search; the page
--     watches the row until it's ready.
--
-- Every quote now gets a picture from the web (the person, or a photograph
-- that suits the words), so image_url stops meaning "public domain only".

alter table public.quotes
  add column if not exists saved_at timestamptz,
  -- Where it came from: the daily pick, the week's top picks, or a shelf.
  add column if not exists origin text not null default 'daily',
  -- Why it was picked, for a top pick (a shelf's quotes don't need one).
  add column if not exists pick_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotes_origin_check') then
    alter table public.quotes add constraint quotes_origin_check check (origin in ('daily', 'pick', 'shelf'));
  end if;
end
$$;

create index if not exists quotes_user_saved on public.quotes (user_id, saved_at desc) where saved_at is not null;

create table if not exists public.quote_collections (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- "top:2026-10-11" for a week's picks, "person:russell-m-nelson",
  -- "theme:grace", "mood:discouraged", "ask:courage-in-business".
  key text not null check (key ~ '^[a-z]+:[a-z0-9-]{1,80}$'),
  facet text not null check (facet in ('top', 'person', 'theme', 'mood', 'ask')),
  label text not null check (length(btrim(label)) between 1 and 80),
  -- What the shelf is for, as the finder reads it.
  hint text check (length(hint) <= 300),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error text,
  quote_ids uuid[] not null default '{}',
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.quote_collections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_collections' and policyname = 'Own quote collections') then
    create policy "Own quote collections" on public.quote_collections
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.quote_collections from anon, public;
grant select, insert, update, delete on public.quote_collections to authenticated;
