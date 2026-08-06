-- Run this in the Supabase SQL Editor (for the existing project).
-- Adds weight tracking: one row per user per day (re-logging overwrites).
create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  weight_kg  numeric     not null check (weight_kg > 0 and weight_kg < 400),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.weight_logs enable row level security;

create policy "Weight: read own"
  on public.weight_logs for select
  using (auth.uid() = user_id);

create policy "Weight: insert own"
  on public.weight_logs for insert
  with check (auth.uid() = user_id);

create policy "Weight: update own"
  on public.weight_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Weight: delete own"
  on public.weight_logs for delete
  using (auth.uid() = user_id);
