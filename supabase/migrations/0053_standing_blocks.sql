-- Standing blocks: the same time, every week.
--
-- A temple shift every Saturday from two to seven is a commitment, and the
-- planner already works around commitments — but only ones sitting on a
-- day. Typing it onto every Saturday by hand is exactly the list nobody
-- maintains. A standing block is written once and stamped onto each
-- matching date as an ordinary commitment, eight weeks ahead.
--
-- Stamped occurrences are plain time_chunks. Move one, or delete one for a
-- week you're away, and it stays that way: `stamped_through` records how far
-- each block has been laid down, and a date is only ever stamped once.

create table if not exists public.standing_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  title text not null,
  category text,
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  stamped_through date,
  created_at timestamptz not null default now()
);

create index if not exists standing_blocks_user_idx on public.standing_blocks (user_id);

alter table public.standing_blocks enable row level security;

drop policy if exists "Own standing blocks" on public.standing_blocks;
create policy "Own standing blocks" on public.standing_blocks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.standing_blocks from anon;

alter table public.time_chunks
  add column if not exists standing_block_id uuid references public.standing_blocks(id) on delete set null;

-- Lays each active block onto every matching date from where it last left
-- off (or today) through eight weeks out. A date that already holds a block
-- at the same times with the same title is adopted rather than doubled, so
-- one typed in by hand before the standing block existed isn't duplicated.
create or replace function public._stamp_standing_blocks(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_block record;
  v_day date;
  v_existing uuid;
  v_count integer := 0;
begin
  select (now() at time zone coalesce(p.timezone, 'America/Denver'))::date into v_today
    from public.profiles p where p.id = p_user_id;
  v_today := coalesce(v_today, (now() at time zone 'America/Denver')::date);

  for v_block in
    select * from public.standing_blocks where user_id = p_user_id and active
  loop
    for v_day in
      select d::date from generate_series(
        greatest(v_today, coalesce(v_block.stamped_through + 1, v_today)),
        v_today + 56, interval '1 day') d
      where extract(dow from d) = v_block.weekday
    loop
      select c.id into v_existing from public.time_chunks c
       where c.user_id = p_user_id and c.date = v_day
         and c.start_time = v_block.start_time and c.end_time = v_block.end_time
         and lower(trim(c.title)) = lower(trim(v_block.title))
       limit 1;

      if v_existing is not null then
        update public.time_chunks
           set standing_block_id = v_block.id,
               source = 'commitment',
               category = coalesce(category, v_block.category)
         where id = v_existing;
      else
        insert into public.time_chunks (user_id, date, start_time, end_time, title, category, source, standing_block_id)
        values (p_user_id, v_day, v_block.start_time, v_block.end_time, v_block.title, v_block.category, 'commitment', v_block.id);
        v_count := v_count + 1;
      end if;
    end loop;

    update public.standing_blocks set stamped_through = v_today + 56 where id = v_block.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._stamp_standing_blocks(uuid) from public, anon, authenticated;

-- Yours, from the app — after adding a block, so it appears straight away.
create or replace function public.stamp_my_standing_blocks()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then 0 else public._stamp_standing_blocks(auth.uid()) end;
$$;

revoke all on function public.stamp_my_standing_blocks() from public, anon;
grant execute on function public.stamp_my_standing_blocks() to authenticated;

-- Stopping a standing block takes its future occurrences with it — past
-- ones are history and stay, as does any future one with tasks hanging off
-- it, since that day has started being planned in detail.
create or replace function public.remove_standing_block(p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_removed integer;
begin
  select (now() at time zone coalesce(p.timezone, 'America/Denver'))::date into v_today
    from public.profiles p where p.id = auth.uid();

  delete from public.time_chunks c
   where c.standing_block_id = p_id
     and c.user_id = auth.uid()
     and c.date >= coalesce(v_today, current_date)
     and not exists (select 1 from public.tasks t where t.time_chunk_id = c.id);
  get diagnostics v_removed = row_count;

  delete from public.standing_blocks where id = p_id and user_id = auth.uid();
  return v_removed;
end;
$$;

revoke all on function public.remove_standing_block(uuid) from public, anon;
grant execute on function public.remove_standing_block(uuid) to authenticated;

-- Everyone's, nightly, so the eight weeks keep rolling forward.
create or replace function public.stamp_all_standing_blocks()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_total integer := 0;
begin
  for v_user in select distinct user_id from public.standing_blocks where active loop
    v_total := v_total + public._stamp_standing_blocks(v_user);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.stamp_all_standing_blocks() from public, anon, authenticated;

select cron.unschedule('standing-blocks') where exists (select 1 from cron.job where jobname = 'standing-blocks');
select cron.schedule('standing-blocks', '15 9 * * *', 'select public.stamp_all_standing_blocks()');
