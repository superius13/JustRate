-- JustRate: who made a title (book author, film director). Optional, shown on the shelf and rating screen.

alter table public.titles
  add column if not exists creator text check (char_length(creator) <= 200);
