-- The Love tab's push key, read by the love-push function (2026-11-06).
--
-- The private half of the VAPID key pair lives in the vault as
-- 'love_vapid_private' (put there once from the SQL editor, never in the
-- repo); this hands it to the service role only. The public half is in
-- src/lib/push.js and supabase/functions/love-push/index.ts. A
-- VAPID_PRIVATE_KEY function secret, if set, wins over this.
--
-- Additive: one function.

create or replace function public.love_vapid_private()
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'love_vapid_private';
$$;

revoke all on function public.love_vapid_private() from public, anon, authenticated;
grant execute on function public.love_vapid_private() to service_role;
