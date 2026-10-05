-- Show what's pending, and let the history start where you say it does.
--
-- Pending purchases were skipped outright, so anything bought on a Saturday
-- was invisible until Chase posted it on Monday — it looked like the sync had
-- missed it. They're now kept in their own small table that each sync
-- replaces wholesale. That keeps the original reason for skipping them: a
-- pending charge often reappears under a new id once it posts, and asking
-- about both would mean asking about one coffee twice. Pending ones are shown,
-- never asked about; the question comes when the posted version arrives.
--
-- history_from is a floor. Transactions posted before it are not stored, so a
-- clean start stays clean when the next sync's overlap window reaches back
-- past it.

alter table public.bank_connections
  add column if not exists history_from timestamptz;

create table if not exists public.bank_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  external_id text not null,
  transacted_at timestamptz,
  amount numeric not null,
  description text not null,
  seen_at timestamptz not null default now(),
  unique (account_id, external_id)
);

create index if not exists bank_pending_user_idx on public.bank_pending (user_id, transacted_at desc);

alter table public.bank_pending enable row level security;

drop policy if exists "Own pending transactions" on public.bank_pending;
create policy "Own pending transactions" on public.bank_pending
  for select to authenticated using (user_id = auth.uid());

-- Written only by ingest_simplefin (security definer); read-only to you.
revoke all on public.bank_pending from public, anon, authenticated;
grant select on public.bank_pending to authenticated;

create or replace function public.ingest_simplefin(p_user_id uuid, p_connection_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
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
  v_floor timestamptz;
  v_accounts integer := 0;
  v_seen integer := 0;
  v_new integer := 0;
  v_pending integer := 0;
  v_transfers integer := 0;
begin
  select coalesce(c.history_from, '-infinity'::timestamptz) into v_floor
    from public.bank_connections c where c.id = p_connection_id;

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

    -- Each sync carries the full pending list, so the old one is replaced.
    delete from public.bank_pending where account_id = v_account_id;

    for v_txn in select * from jsonb_array_elements(coalesce(v_acct->'transactions', '[]'::jsonb))
    loop
      if coalesce((v_txn->>'pending')::boolean, false)
         or coalesce(nullif(v_txn->>'posted', '')::double precision, 0) = 0 then
        insert into public.bank_pending (user_id, account_id, external_id, transacted_at, amount, description)
        values (
          p_user_id, v_account_id, v_txn->>'id',
          to_timestamp(nullif(v_txn->>'transacted_at', '')::double precision),
          (v_txn->>'amount')::numeric,
          coalesce(nullif(v_txn->>'description', ''), '(no description)')
        )
        on conflict (account_id, external_id) do nothing;
        v_pending := v_pending + 1;
        continue;
      end if;

      continue when to_timestamp((v_txn->>'posted')::double precision) < v_floor;

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

  return jsonb_build_object('accounts', v_accounts, 'seen', v_seen, 'new', v_new,
                            'pending', v_pending, 'transfers', v_transfers);
end;
$$;

revoke all on function public.ingest_simplefin(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_simplefin(uuid, uuid, jsonb) to service_role;

-- The backfill offer counts from the floor too, so a clean start doesn't
-- immediately offer to sort what's left of the old history.
create or replace function public.question_cutoff()
returns timestamptz
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    (select greatest(c.created_at - interval '7 days', coalesce(c.history_from, '-infinity'))
       from public.bank_connections c where c.user_id = auth.uid()),
    '-infinity'::timestamptz
  );
$$;

revoke all on function public.question_cutoff() from public, anon;
grant execute on function public.question_cutoff() to authenticated;
