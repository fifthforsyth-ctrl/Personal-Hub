-- Money by hand (Nov 2026).
--
-- The Money tab now counts only purchases Aaron adds himself (by hand or by
-- voice). The bank still syncs, but only its account totals are shown.
--
-- A spoken purchase used to wait for the matching Chase charge and then be
-- folded into it (the spoken row was deleted). With the bank's transactions
-- no longer shown, that would make a voice purchase vanish from the history,
-- so the match now does nothing and every spoken purchase stays as it was said.
-- Additive: no table or column is removed, and the trigger stays in place.

create or replace function public.match_spoken_purchase()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return new;
end;
$$;

update public.bank_transactions
   set awaits_bank = false
 where source = 'manual' and awaits_bank;
