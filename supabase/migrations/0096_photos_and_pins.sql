-- Photos on sections, and pins on photos and sketches (Aaron, 2026-10-30):
-- "allow me to add photos to sections", "use a recent sketch as a photo",
-- and "add pins to any image and sketch. There I can add notes and tasks.
-- When I add a task to a pin it shows up in the same section the image is
-- from."
--
--   section_photos   a photo on a camp section (a clipboard column is a
--                    section too, 0095): a picture he took or chose, kept
--                    in the private note-images bucket under his own
--                    folder (`image_path`), or one of his sketches taken
--                    as it was (`sketch`: { width, height, strokes }, the
--                    sketch it came from in `sketch_id`)
--   image_pins       a point on a photo or a sketch (x, y from 0 to 1
--                    across and down it) with a note
--   camp_steps.pin_id, quest_tasks.pin_id
--                    a task made on a pin: an ordinary step in the photo's
--                    section (or a sketch's step's section, or a sketch's
--                    line's list), that remembers the pin it came from
--
-- Additive only: two new tables and two nullable columns. To undo it, drop
-- the two columns, then the two tables, in the SQL Editor (the photos' files
-- stay in the bucket until removed there).

create table if not exists public.section_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id uuid not null references public.camp_sections(id) on delete cascade,
  image_path text check (image_path is null or (length(image_path) between 3 and 500 and image_path !~ '^/')),
  sketch jsonb check (
    sketch is null
    or (jsonb_typeof(sketch) = 'object' and jsonb_typeof(sketch->'strokes') = 'array' and octet_length(sketch::text) <= 3000000)
  ),
  sketch_id uuid references public.sketches(id) on delete set null,
  -- its size: the picture's pixels, or the sketch's page
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  caption text check (caption is null or length(caption) <= 500),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(image_path, sketch) = 1)
);

create index if not exists section_photos_section on public.section_photos (section_id, position);
create index if not exists section_photos_user on public.section_photos (user_id);

create table if not exists public.image_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- what it's pinned to: exactly one of a section's photo or a sketch
  photo_id uuid references public.section_photos(id) on delete cascade,
  sketch_id uuid references public.sketches(id) on delete cascade,
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  note text check (note is null or length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(photo_id, sketch_id) = 1)
);

create index if not exists image_pins_photo on public.image_pins (photo_id) where photo_id is not null;
create index if not exists image_pins_sketch on public.image_pins (sketch_id) where sketch_id is not null;
create index if not exists image_pins_user on public.image_pins (user_id);

alter table public.camp_steps add column if not exists pin_id uuid references public.image_pins(id) on delete set null;
alter table public.quest_tasks add column if not exists pin_id uuid references public.image_pins(id) on delete set null;
create index if not exists camp_steps_pin on public.camp_steps (pin_id) where pin_id is not null;
create index if not exists quest_tasks_pin on public.quest_tasks (pin_id) where pin_id is not null;

alter table public.section_photos enable row level security;
alter table public.image_pins enable row level security;

-- Yours alone, on your own sections, photos and sketches; a photo's file
-- in your own folder of the bucket.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'section_photos' and policyname = 'Own section photos') then
    create policy "Own section photos" on public.section_photos
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.camp_sections s where s.id = section_id and s.user_id = auth.uid())
        and (image_path is null or split_part(image_path, '/', 1) = auth.uid()::text)
        and (sketch_id is null or exists (select 1 from public.sketches k where k.id = sketch_id and k.user_id = auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'image_pins' and policyname = 'Own pins') then
    create policy "Own pins" on public.image_pins
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and (photo_id is null or exists (select 1 from public.section_photos p where p.id = photo_id and p.user_id = auth.uid()))
        and (sketch_id is null or exists (select 1 from public.sketches k where k.id = sketch_id and k.user_id = auth.uid()))
      );
  end if;
end
$$;

revoke all on public.section_photos, public.image_pins from anon, public;
grant select, insert, update, delete on public.section_photos, public.image_pins to authenticated;
