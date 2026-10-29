-- Temple sync: FamilySearch straight into the Hub, without a file.
--
-- A "Sync to Hub" bookmark in Aaron's browser reads FamilySearch from his
-- signed-in tab (GETs only) and posts the snapshot to the `temple-sync`
-- edge function, which checks the bookmark's key and parks it here. The
-- Temple page loads the newest one the next time it opens, through the
-- same loader as a snapshot file.
--
--   temple_ordinances.reserved_by  who holds a reserved ordinance (FamilySearch's name)
--   temple_ordinances.mine         true when Aaron holds it, false when someone
--                                  else does, null for snapshots that didn't say
--   temple_sync_keys    one key per person, SHA-256 only (like widget_keys)
--   temple_inbox        snapshots the bookmark sent; applied_at once loaded
--   new_temple_sync_key()  makes (or replaces) your key and returns it, once
--
-- Purely additive.
--
-- Rollback (SQL Editor; drops only what this file added):
--   drop function if exists public.new_temple_sync_key();
--   drop table if exists public.temple_inbox, public.temple_sync_keys;
--   alter table public.temple_ordinances drop column if exists reserved_by, drop column if exists mine;

alter table public.temple_ordinances add column if not exists reserved_by text;
alter table public.temple_ordinances add column if not exists mine boolean;

create table if not exists public.temple_sync_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.temple_sync_keys enable row level security;

create policy "temple_sync_keys_select_own" on public.temple_sync_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "temple_sync_keys_delete_own" on public.temple_sync_keys
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.temple_sync_keys from anon, public;
grant select, delete on public.temple_sync_keys to authenticated;

create or replace function public.new_temple_sync_key()
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
  k := 'ts_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.temple_sync_keys (user_id, key_hash)
  values (auth.uid(), encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return k;
end;
$$;

revoke all on function public.new_temple_sync_key() from public, anon;
grant execute on function public.new_temple_sync_key() to authenticated;

-- Written only by the edge function (service role). The app reads its own
-- rows and marks them applied.
create table if not exists public.temple_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  synced_at timestamptz not null,
  received_at timestamptz not null default now(),
  snapshot jsonb not null,
  applied_at timestamptz
);

create index if not exists temple_inbox_user on public.temple_inbox (user_id, synced_at desc);

alter table public.temple_inbox enable row level security;

create policy "temple_inbox_select_own" on public.temple_inbox
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "temple_inbox_update_own" on public.temple_inbox
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.temple_inbox from anon, public;
grant select on public.temple_inbox to authenticated;
grant update (applied_at) on public.temple_inbox to authenticated;
