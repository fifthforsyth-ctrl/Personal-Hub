-- Unfinished tasks stay on the day they were planned (Aaron, 2026-10-14).
--
-- Rollover moved every unfinished task onto today, every day, so tasks from
-- early September were still riding along in mid-October. It no longer
-- moves anything: a task you don't finish stays where you put it, and you
-- move it yourself if you still want it.
--
-- Both functions keep their signatures so an older copy of the app still
-- gets an answer: rollover moves nothing, and nothing is "stalled", since
-- nothing is waiting to be moved.

create or replace function public.rollover_incomplete_tasks(p_today date default current_date, p_max_rollovers integer default 14)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 0;
$function$;

create or replace function public.stalled_tasks(p_today date default current_date)
returns setof public.tasks
language sql
stable
security definer
set search_path to 'public'
as $function$
  select * from public.tasks where false;
$function$;
