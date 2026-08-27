-- record_completion's p_internal flag let ANY authenticated caller skip the
-- ownership check by hitting /rest/v1/rpc/record_completion directly with
-- p_internal=true — record_progress's own "trusted internal call" was
-- exactly as reachable from the outside as a plain client call. Removing
-- the bypass entirely; record_progress now sets completion state inline
-- instead of asking record_completion to trust it.
--
-- (Folded into 0001_init.sql for anyone applying the schema fresh — this
-- file documents the fix for anyone who already applied 0001 as it
-- originally shipped.)

drop function if exists public.record_completion(uuid, text, boolean);

create function public.record_completion(p_node_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_node public.nodes;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;
  if p_kind not in ('daily_checkin', 'one_time') then
    raise exception 'Unknown completion kind';
  end if;

  insert into public.completions (node_id, user_id, kind) values (p_node_id, v_node.user_id, p_kind);

  if p_kind = 'daily_checkin' then
    update public.nodes set is_completed = true, last_daily_check_date = current_date, last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  else
    update public.nodes set is_completed = true, completed_at = now(), last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  end if;
end;
$$;

create or replace function public.record_progress(p_node_id uuid, p_amount numeric default 1)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_node public.nodes;
  v_new_count numeric;
  v_kind text;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;
  if not v_node.has_target_number then
    raise exception 'This node has no target set';
  end if;

  if v_node.is_daily and (v_node.last_daily_check_date is null or v_node.last_daily_check_date <> current_date) then
    update public.nodes
    set current_number = 0, is_completed = false, last_daily_check_date = current_date, updated_at = now()
    where id = p_node_id;
    v_node.current_number := 0;
    v_node.is_completed := false;
  end if;

  if v_node.is_daily and v_node.is_completed then
    return;
  end if;

  insert into public.progress_logs (node_id, user_id, amount) values (p_node_id, v_node.user_id, p_amount);

  v_new_count := v_node.current_number + p_amount;

  update public.nodes
  set current_number = v_new_count,
      last_daily_check_date = case when v_node.is_daily then current_date else last_daily_check_date end,
      last_activity_at = now(),
      updated_at = now()
  where id = p_node_id;

  if v_new_count >= coalesce(v_node.target_number, 0) and not v_node.is_completed then
    v_kind := case when v_node.is_daily then 'daily_checkin' else 'one_time' end;
    insert into public.completions (node_id, user_id, kind) values (p_node_id, v_node.user_id, v_kind);
    if v_kind = 'daily_checkin' then
      update public.nodes set is_completed = true, last_daily_check_date = current_date, updated_at = now() where id = p_node_id;
    else
      update public.nodes set is_completed = true, completed_at = now(), updated_at = now() where id = p_node_id;
    end if;
  end if;
end;
$$;
