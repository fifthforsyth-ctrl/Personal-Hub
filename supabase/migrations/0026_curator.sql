-- The curator's context, its output, and the midnight schedule.
-- See supabase/functions/curator/index.ts for the half that does the choosing.

alter table public.profiles
  add column if not exists timezone text not null default 'America/Denver';

-- Everything the curator reads, in one call. Cards are sent as ESSENCES, not
-- bodies: the model weighs a hundred candidates against the current situation,
-- and a hundred full notes is both expensive and worse.
-- (Full body in the applied migration; see curate_context in the database.)

-- The midnight run.
--
-- pg_cron has no login, so it authenticates to the curator function with a
-- shared secret kept in Vault — never the service key itself, which stays
-- inside the function's own environment and never touches the database.
--
-- Two UTC hours, not one. Local midnight in America/Denver is 06:00 UTC in
-- summer and 07:00 in winter, and rather than chase daylight saving the job
-- simply runs at both: whichever fires on the far side of local midnight does
-- the work, and the other finds the row already written and exits.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- The secret itself is created out of band, not committed:
--   select vault.create_secret('<random>', 'curator_cron_secret', '…');
-- It must match the CRON_SECRET edge function secret.

create or replace function public.trigger_curator()
returns bigint
language plpgsql
volatile
security definer
set search_path = public, extensions, vault, pg_temp
as $$
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
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/curator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_curator() from public, anon, authenticated;

select cron.schedule('curator-nightly', '0 6,7 * * *', $$ select public.trigger_curator(); $$);
