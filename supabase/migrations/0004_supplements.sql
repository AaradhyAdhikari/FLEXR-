-- Flexr: supplements you take, one row each.
-- Run once in Supabase after 0003: SQL Editor > New query > paste this whole file > Run.
-- Safe to re-run.
--
-- Doses taken are NOT here. They ride inside each day's own row in day_logs,
-- which stores the whole day as jsonb, so ticking a dose needs no migration.

create table if not exists public.supplements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

drop trigger if exists touch_updated_at on public.supplements;
create trigger touch_updated_at before update on public.supplements
  for each row execute function public.flexr_touch_updated_at();

alter table public.supplements enable row level security;

drop policy if exists "own supplements" on public.supplements;
create policy "own supplements" on public.supplements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.supplements to authenticated;
revoke all on public.supplements from anon;
