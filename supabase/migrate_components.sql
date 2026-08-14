-- Run this in the Supabase SQL Editor (for existing databases only).
-- Adds the `components` column to meal_logs: the meal broken into its distinct
-- food items with amounts (e.g. ["2 rotis", "150g rice", "matar paneer"]).
-- The dashboard's "most eaten" quick-paste suggestions mine this to detect the
-- stable core of a meal type (e.g. roti + rice) that recurs while a side
-- (curry) varies, so a pill can paste just the stable part.
-- New meals populate it via /api/log-food; rows logged before this migration
-- have NULL (that meal type falls back to whole-meal suggestions until re-logged).
alter table public.meal_logs add column if not exists components text[];
