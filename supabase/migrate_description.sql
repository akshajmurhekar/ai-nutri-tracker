-- Run this in the Supabase SQL Editor (for existing databases only).
-- Adds the `description` column to meal_logs for the clean food-history label.
alter table public.meal_logs add column if not exists description text;
