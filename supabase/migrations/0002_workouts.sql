-- Flexr: workout log (sets, reps, weight).
-- Run once in Supabase after 0001: SQL Editor > New query > paste this whole file > Run.
-- Safe to re-run.

create table if not exists public.workouts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  day date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists workouts_user_day on public.workouts (user_id, day);

drop trigger if exists touch_updated_at on public.workouts;
create trigger touch_updated_at before update on public.workouts
  for each row execute function public.flexr_touch_updated_at();

alter table public.workouts enable row level security;

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.workouts to authenticated;
revoke all on public.workouts from anon;
