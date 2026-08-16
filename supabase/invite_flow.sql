-- ============================================================================
-- AI Nutrition Tracker — profiles table (RUN AFTER schema.sql)
-- Stores each user's display name (used for the "Hi {name}" greeting).
-- *only* contains fields the app uses; roles/approval were removed in favor of
-- Supabase's native "Invite user" flow.
-- ============================================================================

create table if not exists public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  email            text        not null,
  display_name     text,
  -- voluntary metrics for the calories-burned (TDEE) feature
  height_cm        numeric,
  birth_date       date,
  gender           text,
  tdee_updated_at  timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles: read own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
