-- JustRate: initial schema.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Profiles: one per user, holds the name friends see.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Groups of friends who see each other's ratings.
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Shared catalog of titles, so friends' ratings point at the same film or book.
create type public.title_kind as enum ('movie', 'series', 'cartoon', 'book');
create type public.title_source as enum ('kinopoisk', 'google_books', 'manual');

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  kind public.title_kind not null,
  name text not null check (char_length(name) between 1 and 300),
  original_name text,
  year int check (year between 1800 and 2200),
  description text,
  poster_url text,
  source public.title_source not null default 'manual',
  external_id text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

-- One rating per user per title.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  overall smallint not null check (overall between 1 and 10),
  -- Per-criterion scores, e.g. {"plot": 8, "visuals": 9}; each value 1-10.
  criteria jsonb not null default '{}'::jsonb,
  review text check (char_length(review) <= 5000),
  watched_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create index ratings_title_id_idx on public.ratings (title_id);
create index group_members_user_id_idx on public.group_members (user_id);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ratings_touch_updated_at
  before update on public.ratings
  for each row execute function public.touch_updated_at();

-- Helpers for access rules. security definer avoids recursive policy checks.
create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function public.shares_group_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Create a group and join it as the first member.
create function public.create_group(group_name text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.groups (name, created_by) values (group_name, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

-- Join a group by its invite code.
create function public.join_group(code text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into g from public.groups where invite_code = upper(trim(code));
  if g.id is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
    on conflict do nothing;
  return g;
end;
$$;

revoke execute on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Row level security: nobody reads or writes anything unless a policy allows it.
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.titles enable row level security;
alter table public.ratings enable row level security;

create policy "profiles: read own and groupmates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "groups: members read" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "groups: creator renames" on public.groups
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "group_members: members read" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "group_members: leave" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

create policy "titles: signed-in read" on public.titles
  for select to authenticated using (true);
create policy "titles: signed-in add" on public.titles
  for insert to authenticated with check (created_by = auth.uid());

create policy "ratings: read own and groupmates" on public.ratings
  for select to authenticated
  using (user_id = auth.uid() or public.shares_group_with(user_id));
create policy "ratings: add own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());
create policy "ratings: update own" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ratings: delete own" on public.ratings
  for delete to authenticated using (user_id = auth.uid());
