-- Backend tune-up before the redesign goes live. Apply after 0054.
--
-- 1. Task rollover was silently broken. Two versions of
--    rollover_incomplete_tasks existed (one with a cap, one without), so the
--    app's call was ambiguous and the API answered 300 every time; the page
--    swallowed it, so unfinished tasks never moved forward. There is one
--    function now, and it's told the user's own date: the database clock is
--    UTC, which is already tomorrow for most of a Mountain-time evening, so
--    "before today" has to come from the phone, not the server.
--    stalled_tasks gets the same date for the same reason. Both default to
--    the server date so an older copy of the app still gets an answer.
--
-- 2. save_daily_selection skips an id the model mangled instead of failing
--    the whole save (a truncated id aborted a nightly run on Oct 8, and the
--    app then re-ran the curator three times to make up for it).
--
-- 3. curate_context's limits were on the outer aggregate, where they do
--    nothing: 419 candidate cards went to the model in one call instead of
--    200. Each limit now applies to the rows. It also reads the new evening
--    answers (God's hand, toward the Savior, learning from today) alongside
--    the older questions.
--
-- 4. Nothing in this app is meant to be called signed out. Functions stop
--    being executable by anon (every one of them already checked auth.uid(),
--    so this closes a door rather than a hole), trigger functions stop being
--    callable directly, and new functions don't get anon access by default.
--
-- 5. Indexes on the foreign keys the goal roll-ups and note pages join on.
--
-- 6. The twice-daily bank sync takes 50–110 seconds; pg_net gave up at 60.
--
-- 7. link_context had a five-argument version nothing calls any more.

-- 1 ------------------------------------------------------------------------

drop function if exists public.rollover_incomplete_tasks();
drop function if exists public.rollover_incomplete_tasks(integer);

create function public.rollover_incomplete_tasks(p_today date default current_date, p_max_rollovers integer default 14)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  with rolled as (
    update public.tasks
    set date = p_today,
        time_chunk_id = null,
        rollover_count = rollover_count + 1,
        updated_at = now()
    where user_id = auth.uid()
      and status = false
      and date < p_today
      and parent_task_id is null
      and rollover_count < p_max_rollovers
    returning id
  )
  select count(*) into v_count from rolled;

  -- Subtasks follow a parent that moved.
  update public.tasks t
  set date = p_today, updated_at = now()
  where t.user_id = auth.uid()
    and t.status = false
    and t.date < p_today
    and t.parent_task_id is not null
    and exists (select 1 from public.tasks p where p.id = t.parent_task_id and p.date = p_today);

  return v_count;
end;
$function$;

drop function if exists public.stalled_tasks();

create function public.stalled_tasks(p_today date default current_date)
returns setof public.tasks
language sql
security definer
set search_path to 'public'
as $function$
  select * from public.tasks
  where user_id = auth.uid()
    and status = false
    and date < p_today
    and parent_task_id is null
  order by date asc;
$function$;

revoke execute on function public.rollover_incomplete_tasks(date, integer) from public, anon;
revoke execute on function public.stalled_tasks(date) from public, anon;
grant execute on function public.rollover_incomplete_tasks(date, integer) to authenticated, service_role;
grant execute on function public.stalled_tasks(date) to authenticated, service_role;

-- 2 ------------------------------------------------------------------------

create or replace function public.save_daily_selection(p_user_id uuid, p_date date, p_situation text, p_items jsonb)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_selection uuid;
  v_item jsonb;
  v_position integer := 0;
  v_slot text;
  v_note uuid;
begin
  if auth.uid() is not null and v_user is distinct from auth.uid() then
    raise exception 'You can only write your own selection.';
  end if;
  if v_user is null then
    raise exception 'No user to write a selection for.';
  end if;

  insert into public.daily_selections (user_id, for_date, situation)
  values (v_user, p_date, p_situation)
  on conflict (user_id, for_date)
    do update set situation = excluded.situation, created_at = now()
  returning id into v_selection;

  delete from public.daily_selection_items where selection_id = v_selection;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_slot := coalesce(v_item->>'slot', 'day');
    if v_slot not in ('home', 'day') then
      v_slot := 'day';
    end if;

    -- The model is told to copy ids and usually does. One that isn't a
    -- well-formed id, or names a card that isn't theirs or no longer
    -- exists, is skipped rather than failing everything else it chose.
    v_note := null;
    if coalesce(v_item->>'note_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_note := (v_item->>'note_id')::uuid;
    end if;

    if v_note is not null and exists (
      select 1 from public.study_notes n where n.id = v_note and n.user_id = v_user
    ) then
      insert into public.daily_selection_items (user_id, selection_id, note_id, slot, position, reason)
      values (v_user, v_selection, v_note, v_slot, v_position, coalesce(v_item->>'reason', ''));
      v_position := v_position + 1;
    end if;
  end loop;

  -- Being chosen counts as being shown: it feeds the resurfacing cooldown so
  -- the other surfaces don't hand you the same card on the same day.
  update public.study_notes n
     set last_surfaced_at = now(),
         surfaced_count = surfaced_count + 1
   where n.user_id = v_user
     and n.id in (select note_id from public.daily_selection_items where selection_id = v_selection);

  return v_selection;
end;
$function$;

-- 3 ------------------------------------------------------------------------

create or replace function public.curate_context(p_user_id uuid default null, p_tz text default 'UTC', p_date date default null)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_today date := coalesce(p_date, (now() at time zone p_tz)::date);
begin
  if auth.uid() is not null and v_user is distinct from auth.uid() then
    raise exception 'You can only curate your own record.';
  end if;
  if v_user is null then
    raise exception 'No user to curate for.';
  end if;

  return jsonb_build_object(
    'today', v_today,
    'weekday', trim(to_char(v_today, 'Day')),

    -- Where the last stretch actually went, so "applies now" has something to
    -- be measured against.
    'recent_days', coalesce((
      select jsonb_agg(x order by x.day desc) from (
        select d.date as day,
               dp.energy_tag,
               dp.synopsis,
               (select count(*) from public.tasks t
                 where t.user_id = v_user and t.date = d.date and t.parent_task_id is null) as tasks,
               (select count(*) from public.tasks t
                 where t.user_id = v_user and t.date = d.date and t.parent_task_id is null and t.status) as tasks_done
        from generate_series(v_today - 9, v_today, interval '1 day') d(date)
        left join public.day_plans dp on dp.user_id = v_user and dp.date = d.date::date
      ) x
    ), '[]'::jsonb),

    -- What you said about the last few days, in your own words. This is the
    -- strongest signal of what you're actually carrying right now. The
    -- evening's questions changed in October 2026; both sets are read, and
    -- whatever a day didn't answer is left out.
    'recent_reflections', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'date', j.date,
        'gods_hand', left(nullif(j.gods_hand, ''), 400),
        'toward_the_savior', left(nullif(j.q_savior, ''), 400),
        'learning_from_today', left(nullif(j.q_learn, ''), 400),
        'centered', left(nullif(j.q_christ, ''), 400),
        'principles', left(nullif(j.q_principles, ''), 400),
        'direction', left(nullif(j.q_success, ''), 400),
        'gratitude', left(nullif(j.gratitude, ''), 300),
        'journal', left(nullif(j.thoughts, ''), 500)
      )) order by j.date desc)
      from public.journal_entries j
      where j.user_id = v_user and j.date between v_today - 10 and v_today
    ), '[]'::jsonb),

    'focused_goals', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'description', left(n.description, 200)))
      from public.nodes n where n.user_id = v_user and n.is_focused
    ), '[]'::jsonb),

    -- Branches that have gone quiet. Counsel about something you've stopped
    -- doing is more use than counsel about something going well.
    'quiet_goals', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'last_activity', q.last_activity_at)
                       order by q.last_activity_at nulls first)
      from (
        select n.id, n.title, n.last_activity_at
        from public.nodes n
        where n.user_id = v_user
          and not n.is_completed
          and (n.last_activity_at is null or n.last_activity_at < now() - interval '14 days')
        order by n.last_activity_at nulls first
        limit 25
      ) q
    ), '[]'::jsonb),

    'open_tasks', coalesce((
      select jsonb_agg(jsonb_build_object('title', o.title, 'date', o.date, 'rolled', o.rollover_count) order by o.date desc)
      from (
        select t.title, t.date, t.rollover_count
        from public.tasks t
        where t.user_id = v_user and not t.status and t.parent_task_id is null
          and t.date between v_today - 14 and v_today + 1
        order by t.date desc
        limit 40
      ) o
    ), '[]'::jsonb),

    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object('title', c.title, 'start', c.start_time, 'date', c.date) order by c.date, c.start_time)
      from public.time_chunks c
      where c.user_id = v_user and c.date between v_today and v_today + 1
    ), '[]'::jsonb),

    -- The candidates. Pinned first, then newest; capped so this stays one
    -- affordable call however big the shelf gets.
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'kind', c.note_kind,
        'title', c.title,
        'essence', coalesce(nullif(c.essence, ''), nullif(c.ai_theme, ''), left(coalesce(nullif(c.body, ''), c.excerpt, ''), 200)),
        'quote', c.excerpt,
        'has_image', c.image_path is not null,
        'created', c.created_at::date,
        'goal', (select g.title from public.nodes g where g.id = c.linked_goal_id),
        'last_shown', c.last_surfaced_at::date
      ) order by c.pinned desc, c.created_at desc)
      from (
        select n.*
        from public.study_notes n
        where n.user_id = v_user
          and n.obsidian_uid is null       -- vault notes are sources, not cards
          and length(coalesce(nullif(n.body, ''), n.excerpt, '')) > 15
        order by n.pinned desc, n.created_at desc
        limit 200
      ) c
    ), '[]'::jsonb),

    -- How past picks actually landed. This is the whole learning loop: the
    -- model sees what it chose, why it said it chose it, and what you scored
    -- it — so it can stop making the same kind of miss.
    'past_feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', f.for_date,
        'slot', f.slot,
        'card', f.title,
        'kind', f.note_kind,
        'reason_given', f.reason,
        'your_score', f.score,
        'your_note', f.feedback
      ) order by f.scored_at desc)
      from (
        select s.for_date, i.slot, n.title, n.note_kind, i.reason, i.score, i.feedback, i.scored_at
        from public.daily_selection_items i
        join public.daily_selections s on s.id = i.selection_id
        join public.study_notes n on n.id = i.note_id
        where i.user_id = v_user and i.score is not null
        order by i.scored_at desc
        limit 30
      ) f
    ), '[]'::jsonb)
  );
end;
$function$;

-- 4 ------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_can,
           has_function_privilege('service_role', p.oid, 'execute') as service_can
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    -- Keep exactly the access the signed-in app and the nightly jobs have
    -- today, made explicit so it doesn't depend on the PUBLIC grant about to
    -- be removed.
    if r.auth_can then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    if r.service_can then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
    execute format('revoke execute on function %s from public, anon', r.sig);
  end loop;
end
$$;

-- Trigger functions run when their trigger fires; nobody needs to call them.
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.bump_node_activity() from authenticated;
revoke execute on function public.link_time_entry_to_goal() from authenticated;
revoke execute on function public.link_win_loss_to_goal() from authenticated;

-- PUBLIC's default can only be taken away for every schema at once (a
-- per-schema rule can add privileges, not remove global ones), so a function
-- postgres creates anywhere now needs its own grant. Signed-in access to new
-- functions in public still comes from Supabase's own default for
-- authenticated: a function meant only for the server needs an explicit
-- revoke from authenticated.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- 5 ------------------------------------------------------------------------

create index if not exists time_log_entries_goal_node_id_idx on public.time_log_entries (goal_node_id);
create index if not exists win_losses_goal_node_id_idx on public.win_losses (goal_node_id);
create index if not exists tasks_goal_node_id_idx on public.tasks (goal_node_id);
create index if not exists time_chunks_goal_node_id_idx on public.time_chunks (goal_node_id);
create index if not exists study_notes_parent_note_id_idx on public.study_notes (parent_note_id);
create index if not exists note_highlights_note_id_idx on public.note_highlights (note_id);
create index if not exists daily_selection_items_selection_id_idx on public.daily_selection_items (selection_id);

-- 6 ------------------------------------------------------------------------

create or replace function public.trigger_bank_sync()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
as $function$
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
    -- A full sync runs 50–110 seconds; the edge function itself stops at 150.
    timeout_milliseconds := 150000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

-- 7 ------------------------------------------------------------------------

drop function if exists public.link_context(date, date, text, boolean, integer);
