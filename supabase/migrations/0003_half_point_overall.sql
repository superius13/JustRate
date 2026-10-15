-- JustRate: the overall score moves in steps of 0.5 (1, 1.5, … 10). Existing whole scores stay as they are.

alter table public.ratings drop constraint if exists ratings_overall_check;
alter table public.ratings alter column overall type numeric(3, 1);
alter table public.ratings add constraint ratings_overall_check
  check (overall between 1 and 10 and overall * 2 = trunc(overall * 2));
