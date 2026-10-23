-- "Working on it": when Aaron started on a camp step or sub-step, or null.
-- Finishing the step clears it.
--
-- Additive only: one nullable column. To undo it, remove the column in the
-- SQL Editor.

alter table public.camp_steps add column if not exists working_since timestamptz;
