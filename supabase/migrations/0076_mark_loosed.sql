-- The Mark: arrows fly when the day is banked (2026-10-20).
--
-- Tonight's answers are saved as he gives them, so a reflection started on
-- the phone can be finished at the desk. But an arrow only lands on the
-- range when he banks the day: until then a shot is still in hand. This is
-- the moment it was loosed; null means not yet.
--
-- Additive: one new column, nothing existing changes.
--
-- Rollback (SQL Editor):
--   alter table public.mark_shots drop column if exists loosed_at;

alter table public.mark_shots add column if not exists loosed_at timestamptz;
