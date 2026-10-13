-- Quotes that help you press on.
--
-- Each day gets one quote, from a Church leader or a figure from history,
-- chosen by the `quotes` edge function for what the week is about: this
-- week's focus goals, the last few reflections, what's gone quiet. The
-- function looks each new quote up on the web before keeping it, so the
-- wording and the source are the real ones.
--
-- A historical figure comes with a portrait when Wikimedia Commons has a
-- public-domain one; anyone else gets a clean name card. Nothing else is
-- ever shown, since a modern photo usually belongs to someone.
--
-- You rate each one: applies, somewhat, or not now. Quotes that applied come
-- back now and then, and the next picks lean toward what applied and away
-- from what didn't.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 1200),
  author text not null check (length(btrim(author)) between 1 and 200),
  -- 'church' for General Authorities and other Church leaders, 'historical'
  -- for everyone else.
  author_kind text not null default 'historical' check (author_kind in ('church', 'historical')),
  -- Where it was said or written: a talk, a book, a letter, with its year.
  source text,
  source_url text,
  year integer,
  -- True when the wording and source were found on the web, not recalled.
  verified boolean not null default false,
  -- A public-domain portrait from Wikimedia Commons, and who made it.
  image_url text,
  image_credit text,
  image_page text,
  rating text check (rating in ('applies', 'somewhat', 'not_now')),
  rated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quotes_user_created on public.quotes (user_id, created_at desc);

-- Which quote a day had, and why it was picked for that day.
create table if not exists public.quote_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists quote_days_quote on public.quote_days (quote_id);

alter table public.quotes enable row level security;
alter table public.quote_days enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes' and policyname = 'Own quotes') then
    create policy "Own quotes" on public.quotes
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_days' and policyname = 'Own quote days') then
    create policy "Own quote days" on public.quote_days
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.quotes q where q.id = quote_id and q.user_id = auth.uid())
      );
  end if;
end
$$;

revoke all on public.quotes, public.quote_days from anon, public;
grant select, insert, update, delete on public.quotes, public.quote_days to authenticated;

-- The nightly pick, a little after the curator's, using the same secret.
create or replace function public.trigger_quotes()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
as $function$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'curator_cron_secret';

  if v_secret is null then
    raise exception 'curator_cron_secret is not in the vault.';
  end if;

  select net.http_post(
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/quotes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.trigger_quotes() from public, anon, authenticated;

select cron.schedule('quotes-nightly', '20 6,7 * * *', 'select public.trigger_quotes();');
