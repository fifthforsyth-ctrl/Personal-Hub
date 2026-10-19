-- The home screen widget: today's wins, losses and minutes on the phone's
-- home screen, without opening the Hub.
--
-- A widget can't sign in, so it carries a key instead: a long random string
-- made in the app (More > On your phone) and pasted into the widget once.
-- Only its SHA-256 is kept here, the key itself is shown once and never
-- stored. The `widget` edge function looks the key up with the service
-- role and answers with today's numbers for that one person, read-only.
-- Making a new key replaces the old one, and turning the widget off deletes
-- it, so a lost phone is one tap away from showing nothing.
--
--   widget_keys
--     user_id       one key per person
--     key_hash      hex SHA-256 of the key
--     created_at    when it was made
--     last_used_at  the last time a widget asked (the edge function sets it)
--   new_widget_key()  makes (or replaces) your key and returns it, once
--
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop function if exists public.new_widget_key();
--   drop table if exists public.widget_keys;

create table if not exists public.widget_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.widget_keys enable row level security;

-- You can see that your widget is on and when it last asked, and turn it
-- off. Making a key goes through new_widget_key, so the key never passes
-- through a table the app reads.
create policy "widget_keys_select_own" on public.widget_keys
  for select to authenticated using (auth.uid() = user_id);
create policy "widget_keys_delete_own" on public.widget_keys
  for delete to authenticated using (auth.uid() = user_id);

grant select, delete on public.widget_keys to authenticated;

create or replace function public.new_widget_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  k := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.widget_keys (user_id, key_hash)
  values (auth.uid(), encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return k;
end;
$$;

revoke all on function public.new_widget_key() from public, anon;
grant execute on function public.new_widget_key() to authenticated;
