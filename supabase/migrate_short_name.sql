-- Run this in the Supabase SQL Editor (for existing databases only).
-- Adds the `short_name` column to meal_logs: a short, stable canonical base
-- name (e.g. "100mL chai", "rice and roti", "250g rice") that the dashboard's
-- "most eaten" quick-paste suggestions group identical meals by.
-- New meals populate it via /api/log-food; rows logged before this migration
-- have NULL and fall back to description/raw_text on the client.
alter table public.meal_logs add column if not exists short_name text;
