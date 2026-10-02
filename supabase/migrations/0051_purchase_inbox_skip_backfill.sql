-- Don't ask about the backfill.
--
-- Connecting pulls ninety days of history, which put ninety-eight purchases in
-- front of you the moment you connected — exactly the wall of unanswered
-- transactions this was built to avoid, and not what "ask me after a
-- purchase" means. The question now covers what you buy from a week before
-- connecting onward. Everything older stays in your history and can be
-- sorted on purpose from the Money page, where every answer still teaches the
-- merchant memory; it is just never pushed at you.

create or replace function public.question_cutoff()
returns timestamptz
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    (select c.created_at - interval '7 days' from public.bank_connections c where c.user_id = auth.uid()),
    '-infinity'::timestamptz
  );
$$;

revoke all on function public.question_cutoff() from public, anon;
grant execute on function public.question_cutoff() to authenticated;

drop function if exists public.purchase_inbox(integer);

create function public.purchase_inbox(p_limit integer default 25, p_include_history boolean default false)
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
    and (p_include_history or t.posted_at >= public.question_cutoff())
  order by t.posted_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.purchase_inbox(integer, boolean) from public, anon;
grant execute on function public.purchase_inbox(integer, boolean) to authenticated;

-- The overview's count follows the same rule, and reports the backlog
-- separately so the Money page can offer it without nagging about it.
create or replace function public.money_inbox_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'count', count(*) filter (where t.posted_at >= public.question_cutoff()),
    'total', coalesce(-sum(t.amount) filter (where t.posted_at >= public.question_cutoff()), 0),
    'history_count', count(*) filter (where t.posted_at < public.question_cutoff()),
    'history_total', coalesce(-sum(t.amount) filter (where t.posted_at < public.question_cutoff()), 0)
  )
  from public.bank_transactions t
  where t.user_id = auth.uid() and t.reviewed_at is null and not t.is_transfer and t.amount < 0;
$$;

revoke all on function public.money_inbox_counts() from public, anon;
grant execute on function public.money_inbox_counts() to authenticated;

-- Same as 0049, with 'inbox' reading the shared counts.
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

-- The first sync's "range was capped" notice was SimpleFIN being literal
-- about asking for exactly ninety days. The history arrived; clear it.
update public.bank_connections
   set last_error = null
 where last_error like 'Requested date range exceeds limit%';
