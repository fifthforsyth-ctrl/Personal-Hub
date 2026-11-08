-- The builder: an AI you talk to inside the Hub that changes your own Hub
-- (2026-11-08). This first part gives it two things:
--
--   ai_keys     each person's own AI key (Anthropic, OpenAI, Gemini or
--                 OpenRouter), encrypted by the `builder` edge function
--                 before it is stored. Nobody signed in can read this table,
--                 not even its owner: only the edge function (service role)
--                 reads it, so the key never comes back to a browser. The app
--                 learns the provider and the key's last four characters
--                 from the function.
--   ai_changes  every change the builder made, with what it made, so each
--                 one can be undone.
--
-- And two functions that do the writing, as the person signed in (security
-- invoker: every row goes through the same row-level security as the rest
-- of the app, so the builder can only ever touch your own rows):
--
--   builder_apply_quest(p_quest, p_today)  a new quest, its camps, sections,
--     steps and sub-steps, all at once or not at all, logged in ai_changes.
--   builder_undo(p_change, p_force)  takes one of those back. If anything was
--     done or added in that quest since, it asks first (p_force false
--     returns what would be lost instead of deleting).
--
-- Additive only: two tables, two functions. To take it back, in the SQL
-- Editor: drop function builder_undo(uuid, boolean); drop function
-- builder_apply_quest(jsonb, date); drop table ai_changes; drop table ai_keys.

create table if not exists public.ai_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'gemini', 'openrouter')),
  model text check (model is null or length(model) between 1 and 120),
  -- "v1:<base64 iv + AES-GCM ciphertext>", written by the edge function.
  secret text not null check (length(secret) between 10 and 2000),
  last4 text not null check (length(last4) <= 4),
  updated_at timestamptz not null default now()
);

alter table public.ai_keys enable row level security;
-- No policies on purpose: with RLS on and no policy, nobody signed in (or
-- not) can select, insert, update or delete. The service role bypasses RLS.
revoke all on public.ai_keys from anon, authenticated, public;

create table if not exists public.ai_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('new_quest')),
  summary text not null check (length(btrim(summary)) between 1 and 300),
  -- What the change made, e.g. {"quest_id": "...", "camps": 4, "steps": 37}.
  made jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index if not exists ai_changes_user on public.ai_changes (user_id, created_at desc);

alter table public.ai_changes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_changes' and policyname = 'Own builder changes') then
    create policy "Own builder changes" on public.ai_changes
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

revoke all on public.ai_changes from anon, public;
grant select, insert, update on public.ai_changes to authenticated;

-- A new quest from a proposal the person looked at and applied:
-- {"title", "note", "goal_id", "camps": [{"title", "note", "sections":
-- [{"title", "note", "steps": [{"text", "note", "subs": [{"text", "note"}]}]}]}]}
create or replace function public.builder_apply_quest(p_quest jsonb, p_today date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quest uuid;
  v_camp uuid;
  v_section uuid;
  v_step uuid;
  v_change uuid;
  v_pos integer;
  v_camps integer := 0;
  v_steps integer := 0;
  c jsonb;
  s jsonb;
  st jsonb;
  sub jsonb;
  ci bigint;
  si bigint;
  v_goal uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;
  if jsonb_typeof(p_quest -> 'camps') <> 'array' or jsonb_array_length(p_quest -> 'camps') = 0 then
    raise exception 'A quest needs at least one camp.';
  end if;
  if jsonb_array_length(p_quest -> 'camps') > 40 then
    raise exception 'That is more than 40 camps.';
  end if;

  v_goal := nullif(p_quest ->> 'goal_id', '')::uuid;
  if v_goal is not null and not exists (select 1 from nodes n where n.id = v_goal and n.user_id = v_uid) then
    v_goal := null;
  end if;

  insert into quests (user_id, title, note, goal_id, status, started_on, position)
  values (
    v_uid,
    left(btrim(p_quest ->> 'title'), 200),
    nullif(left(coalesce(p_quest ->> 'note', ''), 2000), ''),
    v_goal,
    'on',
    p_today,
    0
  )
  returning id into v_quest;

  for c, ci in select value, ordinality from jsonb_array_elements(p_quest -> 'camps') with ordinality loop
    insert into quest_camps (user_id, quest_id, title, note, position)
    values (v_uid, v_quest, left(btrim(c ->> 'title'), 200), nullif(left(coalesce(c ->> 'note', ''), 4000), ''), ci - 1)
    returning id into v_camp;
    v_camps := v_camps + 1;
    v_pos := 0;

    for s, si in select value, ordinality from jsonb_array_elements(coalesce(c -> 'sections', '[]'::jsonb)) with ordinality loop
      insert into camp_sections (user_id, camp_id, title, note, position)
      values (v_uid, v_camp, left(btrim(s ->> 'title'), 200), nullif(left(coalesce(s ->> 'note', ''), 4000), ''), si - 1)
      returning id into v_section;

      for st in select value from jsonb_array_elements(coalesce(s -> 'steps', '[]'::jsonb)) loop
        insert into camp_steps (user_id, camp_id, section_id, text, note, position)
        values (v_uid, v_camp, v_section, left(btrim(st ->> 'text'), 1000), nullif(left(coalesce(st ->> 'note', ''), 4000), ''), v_pos)
        returning id into v_step;
        v_pos := v_pos + 1;
        v_steps := v_steps + 1;

        for sub in select value from jsonb_array_elements(coalesce(st -> 'subs', '[]'::jsonb)) loop
          insert into camp_steps (user_id, camp_id, section_id, parent_id, text, note, position)
          values (v_uid, v_camp, v_section, v_step, left(btrim(sub ->> 'text'), 1000), nullif(left(coalesce(sub ->> 'note', ''), 4000), ''), v_pos);
          v_pos := v_pos + 1;
          v_steps := v_steps + 1;
        end loop;
      end loop;
    end loop;
  end loop;

  if v_steps > 3000 then
    raise exception 'That is more than 3,000 steps.';
  end if;

  insert into ai_changes (user_id, kind, summary, made)
  values (
    v_uid,
    'new_quest',
    left('New quest: ' || btrim(p_quest ->> 'title'), 300),
    jsonb_build_object('quest_id', v_quest, 'camps', v_camps, 'steps', v_steps)
  )
  returning id into v_change;

  return jsonb_build_object('change_id', v_change, 'quest_id', v_quest, 'camps', v_camps, 'steps', v_steps);
end;
$$;

-- Takes a change back. With p_force false and work done or added since the
-- change, nothing is deleted: it returns {"ask": true, "done": n, "added": m}
-- so the app can ask first.
create or replace function public.builder_undo(p_change uuid, p_force boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  ch ai_changes;
  v_quest uuid;
  v_done integer;
  v_added integer;
begin
  select * into ch from ai_changes where id = p_change and user_id = v_uid;
  if not found then
    raise exception 'That change is not here.';
  end if;
  if ch.undone_at is not null then
    return jsonb_build_object('undone', true, 'already', true);
  end if;

  if ch.kind = 'new_quest' then
    v_quest := (ch.made ->> 'quest_id')::uuid;
    select
      count(*) filter (where st.done_on is not null),
      count(*) filter (where st.created_at > ch.created_at + interval '5 seconds')
    into v_done, v_added
    from camp_steps st
    join quest_camps qc on qc.id = st.camp_id
    where qc.quest_id = v_quest and st.user_id = v_uid;

    if not p_force and (v_done > 0 or v_added > 0) then
      return jsonb_build_object('ask', true, 'done', v_done, 'added', v_added);
    end if;
    delete from quests where id = v_quest and user_id = v_uid;
  end if;

  update ai_changes set undone_at = now() where id = ch.id;
  return jsonb_build_object('undone', true);
end;
$$;

revoke all on function public.builder_apply_quest(jsonb, date) from public, anon;
revoke all on function public.builder_undo(uuid, boolean) from public, anon;
grant execute on function public.builder_apply_quest(jsonb, date) to authenticated;
grant execute on function public.builder_undo(uuid, boolean) to authenticated;
