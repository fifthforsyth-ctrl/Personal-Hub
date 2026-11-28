-- Take the "Laws of the Gospel and Exaltation" quest out of the Hub
-- (Aaron, 2026-11-28): "remove my entire doctrinal search lists of tasks
-- from the hub". A weekly study tracker on Today takes its place (front end
-- only; the minutes come from Study timers).
--
-- Nothing was ever ticked in it (0 of 1,341 steps done), but every row is
-- copied into the private schema first, so it can be put back with one
-- INSERT ... SELECT per table, parents first. Then one DELETE of the quest;
-- its camps, sections, steps and ongoing list go with it by the existing
-- ON DELETE CASCADE. The one planned block that pointed at it ("Search the
-- Scriptures", 2026-11-09) stays and just loses the link (ON DELETE SET NULL).
--
-- No DROP: the backups are new tables, nothing is dropped.

create schema if not exists private;

create table private.laws_quest_backup_2026_11_28_quests as
  select * from public.quests where id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
create table private.laws_quest_backup_2026_11_28_quest_camps as
  select * from public.quest_camps where quest_id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
create table private.laws_quest_backup_2026_11_28_camp_sections as
  select s.* from public.camp_sections s
  join public.quest_camps c on c.id = s.camp_id
  where c.quest_id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
create table private.laws_quest_backup_2026_11_28_camp_steps as
  select st.* from public.camp_steps st
  join public.quest_camps c on c.id = st.camp_id
  where c.quest_id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
create table private.laws_quest_backup_2026_11_28_quest_tasks as
  select * from public.quest_tasks where quest_id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
create table private.laws_quest_backup_2026_11_28_time_chunk_links as
  select id as time_chunk_id, quest_id, camp_id from public.time_chunks
  where quest_id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';

revoke all on all tables in schema private from anon, authenticated;

delete from public.quests where id = 'c4030fa5-16dd-5195-baaf-3c248d6fa8ae';
