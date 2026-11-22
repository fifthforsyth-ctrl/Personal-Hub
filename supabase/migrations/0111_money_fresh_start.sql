-- Money: a fresh start, a way to never fall that far behind again, and one
-- door for a purchase logged by voice.
--
-- Purely additive: two new columns, one trigger, three new functions, and
-- new bodies for four existing functions that keep their signatures and
-- return shapes, so the app that is live while this is applied keeps working.
--
-- 1. Set aside. A purchase that is set aside is kept exactly as the bank sent
--    it, still shows in its month, and is never asked about again. It is not
--    an answer: it stays unsorted (reviewed_at null, no budget), so it never
--    makes a budget look better or worse than it was. archived_at says when
--    it was set aside, and nulling it puts it back in the queue.
--
--    money_set_aside(p_before) sets aside every unanswered purchase posted
--    before a moment. The fresh start is that call with the start day; the
--    "file the rest" button on the Money page is the same call with a week
--    ago. One idea, two uses.
--
-- 2. log_spend. A purchase said out loud ("record a $25 personal purchase for
--    groceries") lands as a manual row that is already answered. If it was
--    paid by card the bank will send the same charge a day or two later;
--    the trigger below gives that bank charge the spoken answer and removes
--    the spoken row, so the money is counted once and never asked about.

alter table public.bank_transactions
  add column if not exists archived_at timestamptz,
  -- A hand-logged purchase the bank is expected to send too. Cash entered on
  -- the Money page never waits for the bank; a spoken one does.
  add column if not exists awaits_bank boolean not null default false;

create index if not exists bank_transactions_awaits_bank_idx
  on public.bank_transactions (user_id, amount)
  where awaits_bank;

-- The queue ---------------------------------------------------------------

create or replace function public.purchase_inbox(p_limit integer default 25, p_include_history boolean default false)
returns table(id uuid, posted_at timestamptz, amount numeric, description text, merchant_key text, account_name text,
              account_kind text, is_business boolean, business_category text, suggested_budget_id uuid,
              suggested_kind text, receipts integer)
language sql
stable
set search_path = public, pg_temp
as $$
  select t.id, t.posted_at, t.amount, t.description, t.merchant_key,
         coalesce(a.nickname, a.name), a.kind, t.is_business, t.business_category,
         t.suggested_budget_id, t.suggested_kind,
         (select count(*)::int from public.receipts r where r.transaction_id = t.id)
  from public.bank_transactions t
  left join public.bank_accounts a on a.id = t.account_id
  where t.user_id = auth.uid()
    and t.reviewed_at is null and t.archived_at is null and not t.is_transfer and t.amount < 0
    and case when p_include_history
             then t.posted_at < public.question_cutoff()
             else t.posted_at >= public.question_cutoff()
        end
  order by t.posted_at desc
  limit greatest(p_limit, 1);
$$;

-- oldest_at and week_old_* let the page offer to set aside what's gone stale.
create or replace function public.money_inbox_counts()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'count', count(*) filter (where t.posted_at >= public.question_cutoff()),
    'total', coalesce(-sum(t.amount) filter (where t.posted_at >= public.question_cutoff()), 0),
    'oldest_at', min(t.posted_at) filter (where t.posted_at >= public.question_cutoff()),
    'week_old_count', count(*) filter (where t.posted_at >= public.question_cutoff() and t.posted_at < now() - interval '7 days'),
    'week_old_total', coalesce(-sum(t.amount) filter (where t.posted_at >= public.question_cutoff() and t.posted_at < now() - interval '7 days'), 0),
    'history_count', count(*) filter (where t.posted_at < public.question_cutoff()),
    'history_total', coalesce(-sum(t.amount) filter (where t.posted_at < public.question_cutoff()), 0)
  )
  from public.bank_transactions t
  where t.user_id = auth.uid() and t.reviewed_at is null and t.archived_at is null
    and not t.is_transfer and t.amount < 0;
$$;

-- Set aside ---------------------------------------------------------------

create or replace function public.money_set_aside(p_before timestamptz)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  with moved as (
    update public.bank_transactions t
       set archived_at = now(), updated_at = now()
     where t.user_id = auth.uid()
       and t.reviewed_at is null and t.archived_at is null
       and not t.is_transfer and t.amount < 0
       and t.posted_at < p_before
    returning t.amount
  )
  select jsonb_build_object('count', count(*), 'total', coalesce(-sum(amount), 0), 'at', now()) from moved;
$$;

-- Back in the queue: one purchase, or everything set aside at one moment.
create or replace function public.money_unset_aside(p_id uuid default null, p_at timestamptz default null)
returns integer
language sql
volatile
set search_path = public, pg_temp
as $$
  with back as (
    update public.bank_transactions t
       set archived_at = null, updated_at = now()
     where t.user_id = auth.uid() and t.archived_at is not null
       and (p_id is null or t.id = p_id)
       and (p_at is null or t.archived_at = p_at)
       and (p_id is not null or p_at is not null)
    returning 1
  )
  select count(*)::int from back;
$$;

revoke all on function public.money_set_aside(timestamptz) from public, anon;
revoke all on function public.money_unset_aside(uuid, timestamptz) from public, anon;
grant execute on function public.money_set_aside(timestamptz) to authenticated;
grant execute on function public.money_unset_aside(uuid, timestamptz) to authenticated;

-- Answering a purchase that was set aside takes it back out of "set aside".
create or replace function public.classify_purchase(p_id uuid, p_budget_id uuid, p_kind text, p_is_business boolean,
                                                    p_business_category text default null, p_note text default null,
                                                    p_remember boolean default true)
returns void
language plpgsql
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
         archived_at = null,
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
      times_confirmed = case
        when public.merchant_rules.budget_id is not distinct from excluded.budget_id
         and public.merchant_rules.purchase_kind is not distinct from excluded.purchase_kind
        then public.merchant_rules.times_confirmed + 1 else 1 end,
      updated_at = now();

    update public.bank_transactions
       set suggested_budget_id = p_budget_id, suggested_kind = nullif(btrim(coalesce(p_kind, '')), '')
     where user_id = auth.uid() and reviewed_at is null and merchant_key = v_key and id <> p_id;
  end if;
end;
$$;

-- The month: unsorted now leaves out what was set aside, which is counted on
-- its own so the page can say so instead of quietly losing it.
create or replace function public.money_overview(p_month date default current_date, p_tz text default 'UTC')
returns jsonb
language sql
stable
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

    'inbox', public.money_inbox_counts(),

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

    'unsorted_this_month', coalesce((
      select -sum(m.amount) from mine m, bounds b
       where m.posted_at >= b.m_start and m.amount < 0 and not m.is_transfer
         and m.reviewed_at is null and m.archived_at is null
    ), 0),
    'set_aside_this_month', coalesce((
      select -sum(m.amount) from mine m, bounds b
       where m.posted_at >= b.m_start and m.amount < 0 and not m.is_transfer
         and m.reviewed_at is null and m.archived_at is not null
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
      'missing_receipts', (select count(*) from mine m
                            where m.is_business and m.amount < 0 and not m.is_transfer
                              and not exists (select 1 from public.receipts r where r.transaction_id = m.id))
    )
  );
$$;

-- Edit distance without needing the fuzzystrmatch extension switched on.
-- Budget names are short, so the plain table is fine.
create or replace function public.levenshtein_safe(a text, b text)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  la int := length(coalesce(a, ''));
  lb int := length(coalesce(b, ''));
  prev int[];
  cur int[];
  i int;
  j int;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  if la > 40 or lb > 40 then return greatest(la, lb); end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cur := cur || least(
        cur[j] + 1,
        prev[j + 1] + 1,
        prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end
      );
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end;
$$;

-- Logging by voice ----------------------------------------------------------
-- Called by the voice function with the service role, which already knows
-- whose watch it is. p_amount is dollars spent, positive. p_budget is the word
-- that was said; it is matched to a budget by name, forgivingly (a typo in
-- the budget's name or a plural in the speech still finds it), and is kept as
-- the kind either way, so nothing said is lost when no budget fits.
create or replace function public.log_spend(
  p_user_id uuid,
  p_amount numeric,
  p_budget text default null,
  p_note text default null,
  p_on date default null,
  p_business boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric := round(abs(coalesce(p_amount, 0)), 2);
  v_said text := nullif(btrim(coalesce(p_budget, '')), '');
  v_key text := regexp_replace(lower(coalesce(p_budget, '')), '[^a-z]', '', 'g');
  v_tz text;
  v_on date;
  v_budget public.budgets%rowtype;
  v_kind text;
  v_category text;
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'log_spend needs a user';
  end if;
  if v_amount <= 0 then
    raise exception 'log_spend needs an amount above zero';
  end if;

  select coalesce(nullif(timezone, ''), 'America/Denver') into v_tz from public.profiles where id = p_user_id;
  v_on := coalesce(p_on, (now() at time zone coalesce(v_tz, 'America/Denver'))::date);

  -- Best budget for the word: exact name, then one starting with the other,
  -- then the closest spelling. Business purchases look at business budgets.
  if v_key <> '' then
    select g.* into v_budget
      from public.budgets g,
           lateral (select regexp_replace(lower(g.name), '[^a-z]', '', 'g') as k) n
     where g.user_id = p_user_id and not g.archived
       and g.kind = case when coalesce(p_business, false) then 'business' else 'personal' end
       and (n.k = v_key
            or (length(v_key) >= 3 and (n.k like v_key || '%' or v_key like n.k || '%'))
            or levenshtein_safe(n.k, v_key) <= greatest(1, length(v_key) / 4))
     order by (n.k = v_key) desc,
              (n.k like v_key || '%' or v_key like n.k || '%') desc,
              levenshtein_safe(n.k, v_key),
              g.position
     limit 1;
  end if;

  -- A business purchase with no budget of its own name goes to the business
  -- budget when there is just one, which is how the Hub is set up today.
  if v_budget.id is null and coalesce(p_business, false) then
    select g.* into v_budget from public.budgets g
     where g.user_id = p_user_id and not g.archived and g.kind = 'business'
       and (select count(*) from public.budgets x where x.user_id = p_user_id and not x.archived and x.kind = 'business') = 1;
  end if;

  -- The tax-style category for a business purchase, when the word names one
  -- ("software" is Software & subscriptions).
  if coalesce(p_business, false) and length(v_key) >= 3 then
    select c into v_category
      from unnest(array['Software & subscriptions','Equipment','Office supplies','Phone & internet','Meals (business)',
                        'Travel','Car & mileage','Advertising','Contract labor','Professional services','Education',
                        'Insurance','Bank fees','Other business']) c
     where regexp_replace(lower(c), '[^a-z]', '', 'g') like v_key || '%'
        or lower(c) ~ ('\m' || v_key)
     limit 1;
  end if;

  v_kind := coalesce(
    (select k from unnest(array['Groceries','Eating out','Gas','Shopping','Bills','Subscriptions','Health','Gifts',
                                'Fun','Travel','Church & giving','Other']) k
      where regexp_replace(lower(k), '[^a-z]', '', 'g') in (v_key, regexp_replace(lower(coalesce(v_budget.name, '')), '[^a-z]', '', 'g'))
      limit 1),
    case when v_said is not null then initcap(v_said) end
  );

  insert into public.bank_transactions
    (user_id, source, posted_at, amount, description, budget_id, purchase_kind, note,
     is_business, business_category, reviewed_at, awaits_bank)
  values (
    p_user_id, 'manual',
    (v_on::timestamp + interval '12 hours') at time zone coalesce(v_tz, 'America/Denver'),
    -v_amount,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), v_said, 'Purchase') ,
    v_budget.id, v_kind, nullif(btrim(coalesce(p_note, '')), ''),
    coalesce(p_business, false), v_category, now(), true
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'amount', v_amount,
    'budget', coalesce(v_budget.name, 'Unsorted'),
    'budget_matched', v_budget.id is not null,
    'business', coalesce(p_business, false),
    'business_category', v_category,
    'on', v_on
  );
end;
$$;

revoke all on function public.log_spend(uuid, numeric, text, text, date, boolean) from public, anon, authenticated;
grant execute on function public.log_spend(uuid, numeric, text, text, date, boolean) to service_role;

-- When the bank sends what was already said --------------------------------
-- Same person, same amount, a spending charge, posted within five days of
-- the spoken one, and the spoken one not yet matched. The bank's row is the
-- record, so it takes the answer and the spoken row goes. The oldest match
-- wins, so two $5 coffees said on two days pair off in order.
create or replace function public.match_spoken_purchase()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_said public.bank_transactions%rowtype;
begin
  if new.source <> 'simplefin' or new.amount >= 0 or coalesce(new.is_transfer, false) then
    return new;
  end if;

  -- The sync re-sends recent charges every time, as an insert that becomes
  -- an update. Only a charge seen for the first time is matched.
  if exists (select 1 from public.bank_transactions x
              where x.account_id = new.account_id and x.external_id = new.external_id) then
    return new;
  end if;

  select * into v_said
    from public.bank_transactions m
   where m.user_id = new.user_id
     and m.awaits_bank
     and m.source = 'manual'
     and m.amount = new.amount
     and m.posted_at between new.posted_at - interval '5 days' and new.posted_at + interval '2 days'
   order by m.posted_at, m.created_at
   limit 1
   for update skip locked;

  if not found then
    return new;
  end if;

  new.budget_id := v_said.budget_id;
  new.purchase_kind := v_said.purchase_kind;
  new.note := coalesce(v_said.note, new.note);
  new.is_business := v_said.is_business;
  new.business_category := v_said.business_category;
  new.reviewed_at := coalesce(v_said.reviewed_at, now());

  delete from public.bank_transactions where id = v_said.id;
  return new;
end;
$$;

create or replace trigger bank_transactions_match_spoken
  before insert on public.bank_transactions
  for each row execute function public.match_spoken_purchase();
