-- Flexr: saved routines (Push day, Legs) you start a session from.
-- Run once in Supabase after 0002: SQL Editor > New query > paste this whole file > Run.
-- Safe to re-run.

create table if not exists public.routines (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

drop trigger if exists touch_updated_at on public.routines;
create trigger touch_updated_at before update on public.routines
  for each row execute function public.flexr_touch_updated_at();

alter table public.routines enable row level security;

drop policy if exists "own routines" on public.routines;
create policy "own routines" on public.routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.routines to authenticated;
revoke all on public.routines from anon;
