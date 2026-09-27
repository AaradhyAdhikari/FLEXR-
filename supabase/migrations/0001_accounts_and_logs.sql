-- Flexr: accounts and per-user data.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.
-- Safe to re-run: it only creates things that don't exist yet.

-- One row per signed-in person (name and age are asked once, after first login).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  age int not null check (age between 10 and 100),
  active_plan_id text check (active_plan_id is null or char_length(active_plan_id) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each person's own food list (seeded with Flexr's starter foods on first login).
create table if not exists public.user_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Each person's diet plans (targets + meals).
create table if not exists public.plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- One row per person per day: what they ate, water, steps, weight, gym, notes.
create table if not exists public.day_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Keep updated_at current on every change.
create or replace function public.flexr_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_foods', 'plans', 'day_logs'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function public.flexr_touch_updated_at()', t);
  end loop;
end;
$$;

-- Row Level Security: every person can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.user_foods enable row level security;
alter table public.plans enable row level security;
alter table public.day_logs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "own foods" on public.user_foods;
create policy "own foods" on public.user_foods
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own day logs" on public.day_logs;
create policy "own day logs" on public.day_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Signed-in users get table access (still limited to their own rows by the policies above).
-- Logged-out visitors get nothing.
grant select, insert, update, delete on public.profiles, public.user_foods, public.plans, public.day_logs to authenticated;
revoke all on public.profiles, public.user_foods, public.plans, public.day_logs from anon;
