-- One name per habit.
--
-- The same win had been tapped under several names ("Get off phone", "Avoid
-- phone", "Off phone", "No phone", plus typos), so the quick-tap chips showed
-- four phone habits and each one's count was a quarter of the truth. This
-- rewrites the label on those old wins to one name per habit: the phone, a
-- cold shower, up on time, and a good breakfast. Nothing is deleted, and
-- labels that say something more ("No phone in bathroom", "Up at 5:45") are
-- left as they are.
--
-- Every change is written to win_label_merges first, so any of them can be
-- put back:
--   update public.win_losses w set habit_label = m.old_label
--   from public.win_label_merges m where m.win_id = w.id;

create table if not exists public.win_label_merges (
  win_id uuid not null references public.win_losses(id) on delete cascade,
  old_label text not null,
  new_label text not null,
  merged_at timestamptz not null default now(),
  primary key (win_id, merged_at)
);

alter table public.win_label_merges enable row level security;
revoke all on public.win_label_merges from anon, authenticated, public;

with map(old_label, new_label) as (
  values
    ('Avoid phone', 'Get off phone'),
    ('Off phone', 'Get off phone'),
    ('No phone', 'Get off phone'),
    ('No pone', 'Get off phone'),
    ('Get off phonw', 'Get off phone'),
    ('Get off the phone', 'Get off phone'),
    ('Avoided phone', 'Get off phone'),
    ('Phone away', 'Get off phone'),
    ('Cold showr', 'Cold shower'),
    ('Cold shwoer', 'Cold shower'),
    ('Gold shower', 'Cold shower'),
    ('Another cold shower', 'Cold shower'),
    ('UpOn time', 'Up on time'),
    ('Upon Time', 'Up on time'),
    ('Wake up on time', 'Up on time'),
    ('Get up on time', 'Up on time'),
    ('Great breakfast', 'Good breakfast'),
    ('Good nutritious breakfast', 'Good breakfast'),
    ('Good fruit for breakfast', 'Good breakfast'),
    ('Great whole food vreakfast', 'Good breakfast'),
    ('Good Whole Foods vreakfast', 'Good breakfast')
), logged as (
  insert into public.win_label_merges (win_id, old_label, new_label)
  select w.id, w.habit_label, m.new_label
  from public.win_losses w
  join map m on m.old_label = w.habit_label
  where w.kind = 'win'
  returning win_id, new_label
)
update public.win_losses w
set habit_label = l.new_label
from logged l
where w.id = l.win_id;
