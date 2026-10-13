-- The Board as a cork board.
--
-- 1. A thought stays one card. The nightly miner, which split long notes
--    into revelation / insight / counsel cards, is switched off. Its function
--    and the cards it already kept stay; the Board folds those cards back
--    under the note they came from.
--
-- 2. Each thought gets a one-line gist and a few quiet tags, written by the
--    `board` edge function after you keep it. They're for finding and
--    resurfacing it later, not for show: the card still reads in your words.
--    gist_at marks a note as done, even when the gist came back empty.
--
-- 3. The curator reads the gist and tags, and this week's focus goals, so
--    what comes back to you matches what the week is for.

alter table public.study_notes
  add column if not exists gist text,
  add column if not exists ai_tags text[] not null default '{}',
  add column if not exists gist_at timestamptz;

-- The backlog the Board asks about: your own short thoughts with no gist yet.
create index if not exists study_notes_needs_gist
  on public.study_notes (user_id, created_at desc)
  where gist_at is null and parent_note_id is null and obsidian_uid is null;

-- 1 ------------------------------------------------------------------------

select cron.unschedule(jobid) from cron.job where jobname = 'miner-nightly';

-- 2 ------------------------------------------------------------------------

create or replace function public.search_notes(p_query text, p_limit integer default 30)
returns table (
  id uuid, title text, note_kind text, parent_note_id uuid, excerpt text, essence text,
  source_ref text, created_at timestamptz, snippet text, in_title boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select array_agg(w) as words
    from (
      select lower(w) as w
      from regexp_split_to_table(btrim(coalesce(p_query, '')), '\s+') as w
      where length(w) > 0
      limit 8
    ) x
  ), notes as (
    select n.id, n.title, n.note_kind, n.parent_note_id, n.excerpt, n.essence, n.source_ref,
           n.created_at, n.updated_at, coalesce(n.body, '') as body,
           lower(n.title || ' ' || coalesce(n.body, '') || ' ' || coalesce(n.excerpt, '') || ' ' ||
                 coalesce(n.essence, '') || ' ' || coalesce(n.source_ref, '') || ' ' ||
                 coalesce(n.gist, '') || ' ' || array_to_string(n.ai_tags, ' ')) as hay
    from public.study_notes n
    where n.user_id = auth.uid()
  ), hits as (
    select n.*,
           (select min(nullif(strpos(lower(n.body), w), 0)) from unnest(q.words) w) as at,
           (select bool_and(strpos(lower(n.title), w) > 0) from unnest(q.words) w) as in_title
    from notes n, q
    where q.words is not null
      and (select bool_and(strpos(n.hay, w) > 0) from unnest(q.words) w)
  )
  select h.id, h.title, h.note_kind, h.parent_note_id, h.excerpt, h.essence, h.source_ref, h.created_at,
         -- A window around the first match in the body, for the result line.
         case when h.at is not null then substr(h.body, greatest(h.at - 70, 1), 220) end,
         h.in_title
  from hits h
  order by h.in_title desc, h.updated_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

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

    -- What this week was set to be for, on Sunday, in their own words.
    'week_focus', coalesce((
      select jsonb_agg(f.title order by f.position, f.created_at)
      from public.focus_goals f
      where f.user_id = v_user and f.week_start = v_today - extract(dow from v_today)::int
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
        'essence', coalesce(nullif(c.essence, ''), nullif(c.gist, ''), nullif(c.ai_theme, ''), left(coalesce(nullif(c.body, ''), c.excerpt, ''), 200)),
        'tags', c.ai_tags,
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
