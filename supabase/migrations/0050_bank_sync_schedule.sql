-- Bank sync, twice a day: 13:00 UTC is 7am in Denver in summer (6am in
-- winter), so the morning shows what you bought yesterday; 01:00 UTC is early
-- evening, which catches anything SimpleFIN picked up during the day. Two
-- requests a day is far inside what SimpleFIN Bridge allows, and the manual
-- "sync now" button is throttled separately.
create or replace function public.trigger_bank_sync()
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
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'curator_cron_secret';
  if v_secret is null then
    raise exception 'curator_cron_secret is not in the vault.';
  end if;

  select net.http_post(
    url := 'https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/bank',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_bank_sync() from public, anon, authenticated;

select cron.schedule('bank-sync', '0 1,13 * * *', $$ select public.trigger_bank_sync(); $$);
