-- Goals: checked in on your own day, undoable, deletable without losing
-- what's under them, and the goal links page counted in the database.
-- Apply after 0055.
--
-- 1. Daily goals reset at UTC midnight. record_progress and record_completion
--    stamped a check-in with the server's current_date, which is already
--    tomorrow for most of a Mountain-time evening: Evening prayer checked at
--    9pm counted for the next day, and a goal checked in the morning showed
--    "Check in" again after 6pm. Both now take the phone's own date. The new
--    parameter defaults to the server date only so the copy of the app still
--    live while this goes out keeps working; the app always sends it.
--    Daily goals the old clock already stamped a day ahead are put back on
--    the day they were actually checked.
--
-- 2. undo_checkin takes back the newest check-in made today, so a mis-tap on
--    "Check in" or a wrong number in "Log" isn't permanent.
--
-- 3. delete_goal. Deleting a goal used to delete one row: its sub-goals
--    popped out as new top-level goals, and everything linked to it was
--    unlinked. Now its sub-goals (and everything under them) move up to its
--    parent, and what was linked to it counts toward that parent instead, so
--    what the parent was fed doesn't change. A top-level goal has nowhere to
--    pass its links; its time goes back to unread rather than reading as a
--    decision that it served no goal.
--
-- 4. mappable_sources. The goal links page downloaded every entry to count
--    categories in the browser, and the API stops at 1,000 rows, so
--    categories went missing as the log grew. The counting happens here now.
--
-- 5. apply_goal_mappings: changing a category's goal moves the entries that
--    rule linked, and unlinking a category lets go of them. Before, the
--    category rule only ever filled empty slots, so a changed link left every
--    past entry on the old goal. A link someone chose (the assistant's read,
--    or a goal picked by hand, including "serves no goal") is still never
--    touched.

-- 1 ------------------------------------------------------------------------

-- PostgREST can't choose between two versions of a function, so the old ones
-- go first. The replacements accept the old calls unchanged.
drop function if exists public.record_progress(uuid, numeric);
drop function if exists public.record_completion(uuid, text);

-- Counter and checkbox goals both log here: roll the amount into
-- current_number and complete the goal once it reaches its target. Daily
-- goals reset lazily on the first check-in of the user's day.
create function public.record_progress(p_node_id uuid, p_amount numeric default 1, p_today date default current_date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := coalesce(p_today, current_date);
  v_node public.nodes;
  v_new_count numeric;
  v_kind text;
begin
  -- Locked so two quick taps can't both read the same count.
  select * into v_node from public.nodes where id = p_node_id for update;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;
  if not v_node.has_target_number then
    raise exception 'This node has no target set';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than zero';
  end if;

  if v_node.is_daily and v_node.last_daily_check_date is distinct from v_today then
    update public.nodes
    set current_number = 0, is_completed = false, last_daily_check_date = v_today, updated_at = now()
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
      last_daily_check_date = case when v_node.is_daily then v_today else last_daily_check_date end,
      last_activity_at = now(),
      updated_at = now()
  where id = p_node_id;

  if v_new_count >= coalesce(v_node.target_number, 0) and not v_node.is_completed then
    v_kind := case when v_node.is_daily then 'daily_checkin' else 'one_time' end;
    insert into public.completions (node_id, user_id, kind) values (p_node_id, v_node.user_id, v_kind);
    if v_kind = 'daily_checkin' then
      update public.nodes set is_completed = true, last_daily_check_date = v_today, updated_at = now() where id = p_node_id;
    else
      update public.nodes set is_completed = true, completed_at = now(), updated_at = now() where id = p_node_id;
    end if;
  end if;
end;
$function$;

create function public.record_completion(p_node_id uuid, p_kind text, p_today date default current_date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := coalesce(p_today, current_date);
  v_node public.nodes;
begin
  select * into v_node from public.nodes where id = p_node_id for update;
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
    update public.nodes set is_completed = true, last_daily_check_date = v_today, last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  else
    update public.nodes set is_completed = true, completed_at = now(), last_activity_at = now(), updated_at = now()
      where id = p_node_id;
  end if;
end;
$function$;

revoke execute on function public.record_progress(uuid, numeric, date) from public, anon;
revoke execute on function public.record_completion(uuid, text, date) from public, anon;
grant execute on function public.record_progress(uuid, numeric, date) to authenticated, service_role;
grant execute on function public.record_completion(uuid, text, date) to authenticated, service_role;

-- A daily goal checked in during an evening before this went out carries
-- the next day's date. Each one goes back to the local date of its latest
-- check-in, read in the owner's own time zone (the app writes it on every
-- load); a zone the database doesn't know is read as UTC.
update public.nodes n
set last_daily_check_date = x.local_day
from (
  select g.id,
         (max(a.created_at) at time zone
            case when exists (select 1 from pg_timezone_names z where z.name = p.timezone) then p.timezone else 'UTC' end
         )::date as local_day
  from public.nodes g
  join public.profiles p on p.id = g.user_id
  join (
    select node_id, created_at from public.progress_logs
    union all
    select node_id, created_at from public.completions
  ) a on a.node_id = g.id
  where g.is_daily
  group by g.id, p.timezone
) x
where x.id = n.id
  and n.last_daily_check_date > x.local_day;

-- 2 ------------------------------------------------------------------------

-- Takes back the newest check-in on this goal made on the user's today
-- (p_today, with p_tz to read the timestamps on the same clock), and the
-- completion it brought with it if the goal is now short of its target. A
-- completion with no count behind it (record_completion) is taken back on
-- its own. Older check-ins stay: this is an undo, not an editor.
create function public.undo_checkin(p_node_id uuid, p_today date, p_tz text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_node public.nodes;
  v_log public.progress_logs;
  v_done public.completions;
  v_count numeric;
  v_uncomplete boolean := false;
begin
  if p_today is null or p_tz is null then
    raise exception 'Today and the time zone are both needed';
  end if;

  select * into v_node from public.nodes where id = p_node_id for update;
  if v_node is null then
    raise exception 'Node not found';
  end if;
  if auth.uid() is distinct from v_node.user_id then
    raise exception 'Not your node';
  end if;

  -- A daily goal whose count belongs to another day has nothing of today's
  -- in it to take back.
  if v_node.is_daily and v_node.last_daily_check_date is distinct from p_today then
    raise exception 'Nothing to undo today';
  end if;

  select * into v_log from public.progress_logs
  where node_id = p_node_id and (created_at at time zone p_tz)::date = p_today
  order by created_at desc
  limit 1;

  select * into v_done from public.completions
  where node_id = p_node_id and (created_at at time zone p_tz)::date = p_today
  order by created_at desc
  limit 1;

  if v_log.id is null and v_done.id is null then
    raise exception 'Nothing to undo today';
  end if;

  v_count := v_node.current_number;
  if v_log.id is not null then
    delete from public.progress_logs where id = v_log.id;
    v_count := greatest(0, v_count - v_log.amount);
  end if;

  if v_node.is_completed and v_done.id is not null
     and (v_log.id is null or v_count < coalesce(v_node.target_number, 0)) then
    delete from public.completions where id = v_done.id;
    v_uncomplete := true;
  end if;

  update public.nodes
  set current_number = v_count,
      is_completed = case when v_uncomplete then false else is_completed end,
      completed_at = case when v_uncomplete and not is_daily then null else completed_at end,
      -- The wheel's "last touched" goes back to whatever happened before.
      last_activity_at = (
        select max(t.at) from (
          select max(created_at) as at from public.progress_logs where node_id = p_node_id
          union all
          select max(created_at) from public.completions where node_id = p_node_id
          union all
          select max(created_at) from public.node_notes where node_id = p_node_id
        ) t
      ),
      updated_at = now()
  where id = p_node_id;
end;
$function$;

revoke execute on function public.undo_checkin(uuid, date, text) from public, anon;
grant execute on function public.undo_checkin(uuid, date, text) to authenticated, service_role;

-- 3 ------------------------------------------------------------------------

-- Runs as the caller, so row security keeps every statement to their own
-- rows. Returns how many sub-goals moved up.
create function public.delete_goal(p_node_id uuid)
returns integer
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_parent uuid;
  v_moved integer;
begin
  if not exists (select 1 from public.nodes where id = p_node_id and user_id = auth.uid()) then
    raise exception 'Goal not found';
  end if;

  -- The parent it's drawn under on the wheel is its first edge.
  select parent_id into v_parent
  from public.node_edges
  where child_id = p_node_id
  order by created_at, id
  limit 1;

  select count(*) into v_moved from public.node_edges where parent_id = p_node_id;

  -- Each sub-goal takes on the goal's parents (almost always one). Their own
  -- sub-goals stay with them.
  insert into public.node_edges (child_id, parent_id, weight)
  select c.child_id, p.parent_id, c.weight
  from public.node_edges c
  join public.node_edges p on p.child_id = p_node_id
  where c.parent_id = p_node_id
    and c.child_id <> p.parent_id
  on conflict (child_id, parent_id) do nothing;

  if v_parent is not null then
    update public.time_log_entries set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.win_losses set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.goal_mappings set goal_node_id = v_parent, updated_at = now() where goal_node_id = p_node_id;
    update public.tasks set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.time_chunks set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.template_chunks set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.template_tasks set goal_node_id = v_parent where goal_node_id = p_node_id;
    update public.spiritual_experiences set linked_goal_id = v_parent where linked_goal_id = p_node_id;
    update public.study_notes set linked_goal_id = v_parent where linked_goal_id = p_node_id;
  else
    -- Left to the foreign key, this time would keep its 'ai' or 'manual'
    -- stamp with no goal, which reads as "served no goal". Nobody decided
    -- that; it goes back to unread. Everything else unlinks on delete.
    update public.time_log_entries
    set goal_node_id = null, goal_link_source = null
    where goal_node_id = p_node_id;
  end if;

  -- Its edges, check-ins and notes go with it.
  delete from public.nodes where id = p_node_id;

  return v_moved;
end;
$function$;

revoke execute on function public.delete_goal(uuid) from public, anon;
grant execute on function public.delete_goal(uuid) to authenticated, service_role;

-- 4 ------------------------------------------------------------------------

-- What you actually track, with how often: every category, every category /
-- subcategory pair, and every habit on the win/loss log. Examples left out.
create function public.mappable_sources()
returns table (source_kind text, source_value text, count integer)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select s.source_kind, s.source_value, s.n
  from (
    select 'category'::text as source_kind, t.category as source_value, count(*)::integer as n
    from public.time_log_entries t
    where t.user_id = auth.uid() and not t.is_example
    group by t.category

    union all

    select 'subcategory', t.category || ' / ' || t.subcategory, count(*)::integer
    from public.time_log_entries t
    where t.user_id = auth.uid() and not t.is_example and coalesce(t.subcategory, '') <> ''
    group by t.category, t.subcategory

    union all

    select 'habit', w.habit_label, count(*)::integer
    from public.win_losses w
    where w.user_id = auth.uid() and not w.is_example
    group by w.habit_label
  ) s
  order by s.n desc, s.source_value;
$function$;

revoke execute on function public.mappable_sources() from public, anon;
grant execute on function public.mappable_sources() to authenticated, service_role;

-- 5 ------------------------------------------------------------------------

-- Returns how many entries and wins changed goal.
create or replace function public.apply_goal_mappings(p_only_confirmed boolean default true)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total integer := 0;
  v_n integer;
begin
  -- Time the rules own: nobody has ruled on it yet, or a rule linked it
  -- (the insert trigger leaves the source empty; a run here stamps
  -- 'mapping'). Each such entry takes the goal its rule names now, the
  -- subcategory's rule ahead of the category's, and goes back to unread when
  -- no rule names one.
  with ruled as (
    select t.id,
           coalesce(
             (select m.goal_node_id
              from public.goal_mappings m
              where m.user_id = auth.uid()
                and m.source_kind = 'subcategory'
                and coalesce(t.subcategory, '') <> ''
                and m.source_value = t.category || ' / ' || t.subcategory
                and m.goal_node_id is not null
                and (m.confirmed or not p_only_confirmed)),
             (select m.goal_node_id
              from public.goal_mappings m
              where m.user_id = auth.uid()
                and m.source_kind = 'category'
                and m.source_value = t.category
                and m.goal_node_id is not null
                and (m.confirmed or not p_only_confirmed))
           ) as goal
    from public.time_log_entries t
    where t.user_id = auth.uid()
      and coalesce(t.goal_link_source, 'mapping') = 'mapping'
  )
  update public.time_log_entries t
  set goal_node_id = r.goal,
      goal_link_source = case when r.goal is null then null else 'mapping' end
  from ruled r
  where t.id = r.id
    and t.goal_node_id is distinct from r.goal;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- Wins have no record of who linked them, so a habit's rule only ever
  -- sets a goal; it never takes one away.
  update public.win_losses w
  set goal_node_id = m.goal_node_id
  from public.goal_mappings m
  where w.user_id = auth.uid()
    and m.user_id = auth.uid()
    and m.goal_node_id is not null
    and (m.confirmed or not p_only_confirmed)
    and m.source_kind = 'habit'
    and m.source_value = w.habit_label
    and w.goal_node_id is distinct from m.goal_node_id;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  return v_total;
end;
$function$;

revoke execute on function public.apply_goal_mappings(boolean) from public, anon;
grant execute on function public.apply_goal_mappings(boolean) to authenticated, service_role;
