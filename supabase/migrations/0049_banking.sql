-- Money: two Chase checking accounts read through SimpleFIN Bridge, monthly
-- budgets, a question after every purchase, and business expenses with their
-- receipts.
--
-- The shape of the security here matters more than anywhere else in the app:
--   · the bank login never touches this app at all — it is entered on
--     SimpleFIN's own site
--   · what the app does hold, the SimpleFIN access URL, lives in Vault and is
--     readable only by the service role. No policy, view or function lets a
--     signed-in browser read it back, including your own
--   · the access is read-only by construction. Nothing here can move money.

-- Connection --------------------------------------------------------------

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'simplefin',
  -- A pointer into Vault, not the secret. Useless without service-role access.
  vault_secret_id uuid,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.bank_connections enable row level security;
create policy "own bank connection" on public.bank_connections
  for select using (auth.uid() = user_id);

-- Accounts ----------------------------------------------------------------

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  external_id text not null,
  org_name text,
  name text not null,
  nickname text,
  -- Decides the default for every transaction in it. Guessed from the name on
  -- first sight and yours to correct.
  kind text not null default 'personal' check (kind in ('personal', 'business')),
  currency text,
  balance numeric(14, 2),
  available_balance numeric(14, 2),
  balance_date timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.bank_accounts enable row level security;
create policy "own bank accounts" on public.bank_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Budgets -----------------------------------------------------------------

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#ef5b3f',
  monthly_limit numeric(12, 2),
  kind text not null default 'personal' check (kind in ('personal', 'business')),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.budgets enable row level security;
create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Merchant keys -----------------------------------------------------------
-- Chase descriptions carry card-processor prefixes, store numbers, dates and
-- cities — "CARD PURCHASE 09/30 SQ *BLUE BOTTLE COF 1234 DENVER CO". The key
-- strips all of that so the same coffee shop is the same merchant every time,
-- which is what lets one answer pre-fill the next. It does not need to be
-- pretty, only stable.
create or replace function public.normalize_merchant(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(array_to_string((regexp_split_to_array(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(p, '')),
              '^(recurring\s+)?(card purchase(\s+with pin)?|pos\s+(debit|purchase)|debit card purchase|purchase authorized on)\s*', ''),
            '^\d{1,2}/\d{1,2}\s+', ''),
          '^(sq|tst|pp|sp|paypal|py|dd|ic|bt|sqc)\s*\*\s*', ''),
        '[*#].*$', ''),
      '[^a-z&.'' ]+', ' ', 'g')
  ), '\s+'))[1:2], ' '), '')
$$;

-- Transactions ------------------------------------------------------------

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null for a cash expense you entered by hand.
  account_id uuid references public.bank_accounts(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  source text not null default 'simplefin' check (source in ('simplefin', 'manual')),
  posted_at timestamptz not null,
  transacted_at timestamptz,
  -- Negative is money out, positive is money in — SimpleFIN's convention, kept
  -- as-is so nothing is ever silently flipped.
  amount numeric(12, 2) not null,
  description text not null,
  payee text,
  memo text,
  merchant_key text generated always as (public.normalize_merchant(coalesce(payee, description))) stored,

  -- What you said about it. Null until you answer.
  budget_id uuid references public.budgets(id) on delete set null,
  purchase_kind text,
  note text,
  is_business boolean not null default false,
  business_category text,
  reviewed_at timestamptz,

  -- What the app guessed from your earlier answers. Kept apart from the real
  -- answer so a guess never counts against a budget until you confirm it.
  suggested_budget_id uuid references public.budgets(id) on delete set null,
  suggested_kind text,

  -- Money moving between your own accounts, or paying off a card. Not a
  -- purchase, never asked about, and visible so a wrong guess can be undone.
  is_transfer boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, external_id)
);

create index if not exists bank_transactions_inbox_idx
  on public.bank_transactions (user_id, posted_at desc)
  where reviewed_at is null and not is_transfer and amount < 0;
create index if not exists bank_transactions_month_idx
  on public.bank_transactions (user_id, posted_at);
create index if not exists bank_transactions_merchant_idx
  on public.bank_transactions (user_id, merchant_key);

alter table public.bank_transactions enable row level security;
create policy "own bank transactions" on public.bank_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Remembered answers ------------------------------------------------------

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  budget_id uuid references public.budgets(id) on delete set null,
  purchase_kind text,
  is_business boolean,
  business_category text,
  times_confirmed integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

alter table public.merchant_rules enable row level security;
create policy "own merchant rules" on public.merchant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Receipts ----------------------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.bank_transactions(id) on delete set null,
  -- Object PATH in the private bucket, never a URL: a stored signed URL is a
  -- link that quietly stops working.
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists receipts_txn_idx on public.receipts (user_id, transaction_id);

alter table public.receipts enable row level security;
create policy "own receipts" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false,
  15728640, -- 15 MB: a multi-page PDF or a full-resolution phone photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

drop policy if exists "own receipts read" on storage.objects;
drop policy if exists "own receipts insert" on storage.objects;
drop policy if exists "own receipts delete" on storage.objects;

create policy "own receipts read" on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts delete" on storage.objects
  for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Vault: the access URL goes in, and only the service role gets it out ------

create or replace function public.store_bank_access(p_user_id uuid, p_access_url text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret uuid;
  v_conn uuid;
begin
  select vault_secret_id into v_secret from public.bank_connections where user_id = p_user_id;

  if v_secret is not null and exists (select 1 from vault.secrets where id = v_secret) then
    perform vault.update_secret(v_secret, p_access_url);
  else
    v_secret := vault.create_secret(
      p_access_url,
      'simplefin_' || p_user_id::text || '_' || extract(epoch from now())::bigint,
      'SimpleFIN access URL. Read-only bank access; service role only.'
    );
  end if;

  insert into public.bank_connections (user_id, vault_secret_id, status, last_error)
  values (p_user_id, v_secret, 'connected', null)
  on conflict (user_id) do update
    set vault_secret_id = excluded.vault_secret_id, status = 'connected', last_error = null
  returning id into v_conn;

  return v_conn;
end;
$$;

create or replace function public.get_bank_access(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select s.decrypted_secret
  from public.bank_connections c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.user_id = p_user_id and c.status <> 'disconnected';
$$;

-- Disconnecting destroys the secret, not just the pointer to it.
create or replace function public.forget_bank_access(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret uuid;
begin
  select vault_secret_id into v_secret from public.bank_connections where user_id = p_user_id;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  update public.bank_connections
     set vault_secret_id = null, status = 'disconnected'
   where user_id = p_user_id;
end;
$$;

revoke all on function public.store_bank_access(uuid, text) from public, anon, authenticated;
revoke all on function public.get_bank_access(uuid) from public, anon, authenticated;
revoke all on function public.forget_bank_access(uuid) from public, anon, authenticated;
grant execute on function public.store_bank_access(uuid, text) to service_role;
grant execute on function public.get_bank_access(uuid) to service_role;
grant execute on function public.forget_bank_access(uuid) to service_role;

-- Ingest: one SimpleFIN response in, accounts and transactions out ----------
-- In SQL rather than in the edge function so the whole sync is one
-- transaction: a response that half-applies can't leave balances from today
-- next to transactions from last week.
create or replace function public.ingest_simplefin(p_user_id uuid, p_connection_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_acct jsonb;
  v_txn jsonb;
  v_account_id uuid;
  v_kind text;
  v_org text;
  v_inserted boolean;
  v_accounts integer := 0;
  v_seen integer := 0;
  v_new integer := 0;
  v_transfers integer := 0;
begin
  for v_acct in select * from jsonb_array_elements(coalesce(p_payload->'accounts', '[]'::jsonb))
  loop
    -- v1 put the bank on each account as `org`; v2 moved it to a separate
    -- `connections` list joined by conn_id. Either is accepted.
    v_org := coalesce(
      v_acct->'org'->>'name',
      (select c->>'name' from jsonb_array_elements(coalesce(p_payload->'connections', '[]'::jsonb)) c
        where c->>'conn_id' = v_acct->>'conn_id' limit 1)
    );

    insert into public.bank_accounts
      (user_id, connection_id, external_id, org_name, name, currency, balance, available_balance, balance_date, kind)
    values (
      p_user_id, p_connection_id, v_acct->>'id', v_org, coalesce(v_acct->>'name', 'Account'),
      v_acct->>'currency',
      nullif(v_acct->>'balance', '')::numeric,
      nullif(v_acct->>'available-balance', '')::numeric,
      to_timestamp(nullif(v_acct->>'balance-date', '')::double precision),
      case when coalesce(v_acct->>'name', '') ~* '(business|biz|llc|\minc\M|corp)' then 'business' else 'personal' end
    )
    on conflict (user_id, external_id) do update set
      connection_id = excluded.connection_id,
      org_name = excluded.org_name,
      name = excluded.name,
      currency = excluded.currency,
      balance = excluded.balance,
      available_balance = excluded.available_balance,
      balance_date = excluded.balance_date,
      updated_at = now()
    returning id, kind into v_account_id, v_kind;

    v_accounts := v_accounts + 1;

    for v_txn in select * from jsonb_array_elements(coalesce(v_acct->'transactions', '[]'::jsonb))
    loop
      -- Pending transactions are skipped. They often reappear under a new id
      -- once they post, and storing both would mean asking about one coffee
      -- twice. A day's wait for the posted version is the honest price.
      continue when coalesce((v_txn->>'pending')::boolean, false)
                 or coalesce(nullif(v_txn->>'posted', '')::double precision, 0) = 0;

      v_seen := v_seen + 1;

      insert into public.bank_transactions
        (user_id, account_id, external_id, source, posted_at, transacted_at, amount, description, payee, memo, is_business)
      values (
        p_user_id, v_account_id, v_txn->>'id', 'simplefin',
        to_timestamp((v_txn->>'posted')::double precision),
        to_timestamp(nullif(v_txn->>'transacted_at', '')::double precision),
        (v_txn->>'amount')::numeric,
        coalesce(nullif(v_txn->>'description', ''), '(no description)'),
        nullif(v_txn->>'payee', ''),
        nullif(v_txn->>'memo', ''),
        v_kind = 'business'
      )
      on conflict (account_id, external_id) do update set
        posted_at = excluded.posted_at,
        amount = excluded.amount,
        description = excluded.description,
        payee = excluded.payee,
        memo = excluded.memo,
        updated_at = now()
      returning (xmax = 0) into v_inserted;

      if v_inserted then
        v_new := v_new + 1;
      end if;
    end loop;
  end loop;

  -- Pre-fill new questions from earlier answers about the same merchant.
  update public.bank_transactions t
     set suggested_budget_id = r.budget_id,
         suggested_kind = r.purchase_kind,
         is_business = coalesce(r.is_business, t.is_business),
         business_category = coalesce(t.business_category, r.business_category)
    from public.merchant_rules r
   where t.user_id = p_user_id
     and r.user_id = p_user_id
     and t.reviewed_at is null
     and t.suggested_budget_id is null
     and t.suggested_kind is null
     and t.merchant_key is not null
     and t.merchant_key = r.merchant_key;

  -- Transfers. A matching opposite amount in another of your own accounts
  -- within three days is money moving between them; a card payment from
  -- checking is paying for purchases already counted elsewhere. Neither is a
  -- purchase, and both stay visible and reversible.
  with pairs as (
    select t.id
    from public.bank_transactions t
    join public.bank_transactions o
      on o.user_id = t.user_id
     and o.account_id is distinct from t.account_id
     and o.amount = -t.amount
     and abs(extract(epoch from (o.posted_at - t.posted_at))) <= 3 * 86400
    where t.user_id = p_user_id
      and t.account_id is not null and o.account_id is not null
      and not t.is_transfer and t.reviewed_at is null
  ), named as (
    select t.id from public.bank_transactions t
    where t.user_id = p_user_id and not t.is_transfer and t.reviewed_at is null
      and t.description ~* '^(online transfer (to|from)|payment to chase card|chase credit crd autopay|online payment .* to chase)'
  )
  update public.bank_transactions
     set is_transfer = true
   where id in (select id from pairs union select id from named);
  get diagnostics v_transfers = row_count;

  update public.bank_connections
     set last_synced_at = now(), last_error = null, status = 'connected'
   where id = p_connection_id;

  return jsonb_build_object('accounts', v_accounts, 'seen', v_seen, 'new', v_new, 'transfers', v_transfers);
end;
$$;

revoke all on function public.ingest_simplefin(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_simplefin(uuid, uuid, jsonb) to service_role;

-- Answering the question ----------------------------------------------------

create or replace function public.classify_purchase(
  p_id uuid,
  p_budget_id uuid,
  p_kind text,
  p_is_business boolean,
  p_business_category text default null,
  p_note text default null,
  p_remember boolean default true
)
returns void
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key text;
begin
  update public.bank_transactions
     set budget_id = p_budget_id,
         purchase_kind = nullif(btrim(coalesce(p_kind, '')), ''),
         is_business = coalesce(p_is_business, false),
         business_category = case when coalesce(p_is_business, false) then nullif(btrim(coalesce(p_business_category, '')), '') else null end,
         note = nullif(btrim(coalesce(p_note, '')), ''),
         reviewed_at = now(),
         updated_at = now()
   where id = p_id and user_id = auth.uid()
  returning merchant_key into v_key;

  if p_remember and v_key is not null then
    insert into public.merchant_rules (user_id, merchant_key, budget_id, purchase_kind, is_business, business_category)
    values (auth.uid(), v_key, p_budget_id, nullif(btrim(coalesce(p_kind, '')), ''), p_is_business, p_business_category)
    on conflict (user_id, merchant_key) do update set
      budget_id = excluded.budget_id,
      purchase_kind = excluded.purchase_kind,
      is_business = excluded.is_business,
      business_category = excluded.business_category,
      -- Counts agreement, and starts over when the answer changes.
      times_confirmed = case
        when public.merchant_rules.budget_id is not distinct from excluded.budget_id
         and public.merchant_rules.purchase_kind is not distinct from excluded.purchase_kind
        then public.merchant_rules.times_confirmed + 1 else 1 end,
      updated_at = now();

    -- Anything else from the same merchant still waiting gets the new guess.
    update public.bank_transactions
       set suggested_budget_id = p_budget_id, suggested_kind = nullif(btrim(coalesce(p_kind, '')), '')
     where user_id = auth.uid() and reviewed_at is null and merchant_key = v_key and id <> p_id;
  end if;
end;
$$;

-- Changing an account's kind carries through to everything in it you haven't
-- answered yet. Answered ones keep what you said.
create or replace function public.set_account_kind(p_account_id uuid, p_kind text)
returns void
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  update public.bank_accounts set kind = p_kind, updated_at = now()
   where id = p_account_id and user_id = auth.uid();
  update public.bank_transactions set is_business = (p_kind = 'business')
   where account_id = p_account_id and user_id = auth.uid() and reviewed_at is null;
$$;

-- Reading it ----------------------------------------------------------------

create or replace function public.purchase_inbox(p_limit integer default 25)
returns table (
  id uuid, posted_at timestamptz, amount numeric, description text, merchant_key text,
  account_name text, account_kind text, is_business boolean, business_category text,
  suggested_budget_id uuid, suggested_kind text, receipts integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select t.id, t.posted_at, t.amount, t.description, t.merchant_key,
         coalesce(a.nickname, a.name), a.kind, t.is_business, t.business_category,
         t.suggested_budget_id, t.suggested_kind,
         (select count(*)::int from public.receipts r where r.transaction_id = t.id)
  from public.bank_transactions t
  left join public.bank_accounts a on a.id = t.account_id
  where t.user_id = auth.uid()
    and t.reviewed_at is null and not t.is_transfer and t.amount < 0
  order by t.posted_at desc
  limit greatest(p_limit, 1);
$$;

create or replace function public.money_overview(p_month date default current_date, p_tz text default 'UTC')
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with bounds as (
    select (date_trunc('month', p_month)::date::timestamp at time zone p_tz) as m_start,
           ((date_trunc('month', p_month) + interval '1 month')::date::timestamp at time zone p_tz) as m_end,
           (date_trunc('year', p_month)::date::timestamp at time zone p_tz) as y_start
  ), mine as (
    select t.* from public.bank_transactions t, bounds b
    where t.user_id = auth.uid() and t.posted_at >= b.y_start and t.posted_at < b.m_end
  )
  select jsonb_build_object(
    'month', date_trunc('month', p_month)::date,
    'connection', (select jsonb_build_object('status', c.status, 'last_synced_at', c.last_synced_at, 'last_error', c.last_error)
                     from public.bank_connections c where c.user_id = auth.uid()),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'nickname', a.nickname, 'kind', a.kind, 'org', a.org_name,
        'balance', a.balance, 'available', a.available_balance, 'as_of', a.balance_date, 'hidden', a.hidden
      ) order by a.kind, a.name)
      from public.bank_accounts a where a.user_id = auth.uid()
    ), '[]'::jsonb),

    'inbox', (select jsonb_build_object('count', count(*), 'total', coalesce(-sum(t.amount), 0))
                from public.bank_transactions t
               where t.user_id = auth.uid() and t.reviewed_at is null and not t.is_transfer and t.amount < 0),

    'budgets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'color', g.color, 'limit', g.monthly_limit, 'kind', g.kind,
        'spent', coalesce((select -sum(m.amount) from mine m, bounds b
                            where m.budget_id = g.id and m.amount < 0 and not m.is_transfer
                              and m.posted_at >= b.m_start), 0),
        'count', (select count(*) from mine m, bounds b
                   where m.budget_id = g.id and m.amount < 0 and m.posted_at >= b.m_start)
      ) order by g.position, g.name)
      from public.budgets g where g.user_id = auth.uid() and not g.archived
    ), '[]'::jsonb),

    -- Shown next to the budgets so they can't look healthier than they are:
    -- money already spent this month that hasn't been placed anywhere yet.
    'unsorted_this_month', coalesce((
      select -sum(m.amount) from mine m, bounds b
       where m.posted_at >= b.m_start and m.amount < 0 and not m.is_transfer and m.reviewed_at is null
    ), 0),

    'spent_this_month', coalesce((
      select -sum(m.amount) from mine m, bounds b
       where m.posted_at >= b.m_start and m.amount < 0 and not m.is_transfer and not m.is_business
    ), 0),
    'income_this_month', coalesce((
      select sum(m.amount) from mine m, bounds b
       where m.posted_at >= b.m_start and m.amount > 0 and not m.is_transfer
    ), 0),

    'business', jsonb_build_object(
      'month_total', coalesce((select -sum(m.amount) from mine m, bounds b
                                where m.is_business and m.amount < 0 and not m.is_transfer and m.posted_at >= b.m_start), 0),
      'year_total', coalesce((select -sum(m.amount) from mine m
                               where m.is_business and m.amount < 0 and not m.is_transfer), 0),
      'by_category', coalesce((
        select jsonb_agg(x order by x.total desc) from (
          select coalesce(m.business_category, 'Uncategorised') as category, -sum(m.amount) as total, count(*) as count
          from mine m where m.is_business and m.amount < 0 and not m.is_transfer
          group by 1
        ) x
      ), '[]'::jsonb),
      -- The number that matters at tax time.
      'missing_receipts', (select count(*) from mine m
                            where m.is_business and m.amount < 0 and not m.is_transfer
                              and not exists (select 1 from public.receipts r where r.transaction_id = m.id))
    )
  );
$$;

-- Postgres grants EXECUTE to PUBLIC by default. These all filter on
-- auth.uid() and would return nothing to an anonymous caller anyway, but
-- money functions should not be reachable signed-out even in principle.
revoke all on function public.classify_purchase(uuid, uuid, text, boolean, text, text, boolean) from public, anon;
revoke all on function public.set_account_kind(uuid, text) from public, anon;
revoke all on function public.purchase_inbox(integer) from public, anon;
revoke all on function public.money_overview(date, text) from public, anon;
grant execute on function public.classify_purchase(uuid, uuid, text, boolean, text, text, boolean) to authenticated;
grant execute on function public.set_account_kind(uuid, text) to authenticated;
grant execute on function public.purchase_inbox(integer) to authenticated;
grant execute on function public.money_overview(date, text) to authenticated;
