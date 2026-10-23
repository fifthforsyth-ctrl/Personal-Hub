-- Urgency on camp steps and sub-steps: red, yellow or green, or none.
--
-- Additive only: one nullable column. To undo it, remove the column in the
-- SQL Editor.

alter table public.camp_steps add column if not exists urgency text check (urgency is null or urgency in ('red', 'yellow', 'green'));
