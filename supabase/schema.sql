-- ============================================================================
-- AI Nutrition Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: user_quotas
-- Tracks how many LLM queries each user has used today against their limit.
-- ---------------------------------------------------------------------------
create table if not exists public.user_quotas (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  queries_used_today integer not null default 0,
  daily_limit        integer not null default 600,
  last_reset_date    date    not null default current_date
);

-- ---------------------------------------------------------------------------
-- Table: meal_logs
-- One row per accepted (food) meal entry.
-- ---------------------------------------------------------------------------
create table if not exists public.meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  meal_type   text        not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  raw_text    text        not null,
  description text,
  calories    numeric     not null,
  protein     numeric     not null,
  carbs       numeric     not null,
  fat         numeric     not null
);

-- ---------------------------------------------------------------------------
-- Indexes for the weekly dashboard query (day + meal_type breakdown).
-- ---------------------------------------------------------------------------
create index if not exists meal_logs_user_created_idx
  on public.meal_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.user_quotas enable row level security;
alter table public.meal_logs   enable row level security;

-- user_quotas: users can read + update only their own quota row
create policy "Users read own quota"
  on public.user_quotas
  for select
  using (auth.uid() = user_id);

create policy "Users update own quota"
  on public.user_quotas
  for update
  using (auth.uid() = user_id);

-- meal_logs: users can read / insert / delete only their own meals
-- (insert with a check forces user_id to be the caller's id)
create policy "Users read own meals"
  on public.meal_logs
  for select
  using (auth.uid() = user_id);

create policy "Users insert own meals"
  on public.meal_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users delete own meals"
  on public.meal_logs
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPC: increment_quota_if_within_limit
-- Atomically (row-locked):
--   1. lazily creates a quota row for the user if it doesn't exist
--   2. resets today's counter if last_reset_date rolled over
--   3. rejects (returns allowed=false) when the daily limit is reached
--   4. otherwise increments and returns the updated count
--
-- security definer so counter updates always run, guarded by auth.uid()
-- so callers can never touch another user's quota.
-- ---------------------------------------------------------------------------
-- NOTE: return column names are intentionally DISTINCT from the underlying table
-- columns. If an OUT param shares a name with a `user_quotas` column (e.g.
-- `queries_used_today`), Postgres raises "column reference ... is ambiguous"
-- for unqualified references inside the body.
create or replace function public.increment_quota_if_within_limit(p_user_id uuid)
returns table (
  allowed    boolean,
  used_today integer,
  day_limit  integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used         integer;
  v_limit        integer;
begin
  -- Only ever operate on the caller's own quota.
  if p_user_id is null or auth.uid() is null or auth.uid() <> p_user_id then
    return query select false, 0, 0;
    return;
  end if;

  -- Lazily create a quota row (defaults applied).
  insert into public.user_quotas (user_id, queries_used_today, daily_limit, last_reset_date)
  values (p_user_id, 0, 600, current_date)
  on conflict (user_id) do nothing;

  -- Roll the daily counter over when the calendar date changes.
  update public.user_quotas
     set queries_used_today = 0,
         last_reset_date    = current_date
   where user_id = p_user_id
     and last_reset_date < current_date;

  -- Lock the row so concurrent requests serialize here.
  select q.queries_used_today, q.daily_limit
    into v_used, v_limit
    from public.user_quotas q
   where q.user_id = p_user_id
   for update;

  if v_used >= v_limit then
    return query select false, v_used, v_limit;
    return;
  end if;

  update public.user_quotas
     set queries_used_today = queries_used_today + 1
   where user_id = p_user_id;

  return query select true, v_used + 1, v_limit;
end;
$$;

-- Only authenticated users may call the RPC.
revoke execute on function public.increment_quota_if_within_limit(uuid) from public, anon;
grant  execute on function public.increment_quota_if_within_limit(uuid) to authenticated;
