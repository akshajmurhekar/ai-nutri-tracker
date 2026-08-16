-- Run this in the Supabase SQL Editor (for existing databases only).
-- Adds the "calories burned" (energy balance) feature:
--   1) Voluntary metrics on `profiles` (height, birth date, gender) used to
--      estimate TDEE, plus a `tdee_updated_at` stamp so the weekly refresh can
--      tell whether a recompute is due.
--   2) `energy_logs`: one row per user per day holding that day's TDEE baseline
--      and any gym calories logged on top of it. Total burned = tdee + gym.
-- The dashboard's BurnCard reads this; get /api/burn recomputes TDEE lazily
-- (max ~once a week per user) via Gemini.

-- ---------------------------------------------------------------------------
-- profiles: voluntary metrics + last-TDEE-compute stamp
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists height_cm  numeric;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists gender     text;
alter table public.profiles add column if not exists tdee_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- energy_logs
-- ---------------------------------------------------------------------------
create table if not exists public.energy_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  date          date        not null,
  bmr           numeric,
  tdee          numeric,
  gym_calories  numeric     not null default 0 check (gym_calories >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists energy_logs_user_date_idx
  on public.energy_logs (user_id, date desc);

alter table public.energy_logs enable row level security;

create policy "Energy: read own"
  on public.energy_logs for select
  using (auth.uid() = user_id);

create policy "Energy: insert own"
  on public.energy_logs for insert
  with check (auth.uid() = user_id);

create policy "Energy: update own"
  on public.energy_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Energy: delete own"
  on public.energy_logs for delete
  using (auth.uid() = user_id);
