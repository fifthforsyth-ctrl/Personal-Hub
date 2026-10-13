-- Ask: a conversation with an assistant that reads your whole Hub.
--
-- You ask in your own words ("how has my sleep gone since I started the
-- early mornings?", "chart my study minutes against my wins"). The `ask`
-- function looks things up in your own tables, as many times as it needs,
-- and answers in plain words with charts where a chart says it better.
--
-- ask_conversations keeps each conversation, so it can be picked up again
-- on another device, and so an answer that finishes after you've put the
-- phone away is still there when you come back. `messages` is the whole
-- exchange: your questions, and each answer with its charts and their rows.
--
-- ask_select runs one of the assistant's queries. Like run_readonly_select
-- it executes as you (security invoker), so row-level security keeps it to
-- your own rows, and it refuses anything but a single SELECT. It also puts
-- the transaction in read-only mode first, so even a function a query
-- calls can't write.
--
-- Additive only.

create table if not exists public.ask_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  -- Set while an answer is being worked out; cleared when it lands.
  working_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ask_conversations_user_updated
  on public.ask_conversations (user_id, updated_at desc);

alter table public.ask_conversations enable row level security;

create policy "own ask conversations" on public.ask_conversations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.ask_conversations to authenticated;

create or replace function public.ask_select(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sql text := btrim(btrim(p_sql), ';');
  v_result jsonb;
begin
  if position(';' in v_sql) > 0 then
    raise exception 'Only one statement is allowed.';
  end if;

  if v_sql !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT is allowed.';
  end if;

  if v_sql ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|vacuum|refresh|listen|notify|set|reset|lock|prepare|execute)\M' then
    raise exception 'Only a read-only SELECT is allowed.';
  end if;

  -- From here to the end of the call, nothing can be written.
  perform set_config('transaction_read_only', 'on', true);

  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t',
    'select * from (' || v_sql || ') q limit 1000'
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.ask_select(text) from public, anon;
grant execute on function public.ask_select(text) to authenticated;
