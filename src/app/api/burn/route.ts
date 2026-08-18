import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { authenticate } from '@/lib/auth';
import { estimateEnergy } from '@/lib/gemini';
import { ENERGY_REFRESH_DAYS, MAX_GYM_CALORIES } from '@/lib/constants';
import type { EnergyDay } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-mm-dd for a Date, matching the weight route's (UTC) day key. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Age in whole years from a yyyy-mm-dd birth date. */
function ageYears(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const monthsDiff = now.getUTCMonth() - (m - 1);
  const daysDiff = now.getUTCDate() - d;
  if (monthsDiff < 0 || (monthsDiff === 0 && daysDiff < 0)) age--;
  return age;
}

function clampDays(n: number): number {
  return Math.min(Math.max(Math.round(n) || 7, 1), 90);
}

/** The last `days` day keys, oldest → newest. */
function recentDayKeys(days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(Date.now() - i * DAY_MS)));
  }
  return keys;
}

interface ProfileRow {
  height_cm: number | null;
  birth_date: string | null;
  gender: 'male' | 'female' | null;
  tdee_updated_at: string | null;
}

interface EnergyRow {
  date: string;
  bmr: number | null;
  tdee: number | null;
  gym_calories: number | null;
}

function toEnergyDay(r: EnergyRow): EnergyDay {
  const gym = Number(r.gym_calories) || 0;
  const tdee = r.tdee != null ? Number(r.tdee) : null;
  return {
    date: r.date,
    bmr: r.bmr != null ? Number(r.bmr) : null,
    tdee,
    gym_calories: gym,
    total_burned: (tdee ?? 0) + gym,
  };
}

/**
 * GET /api/burn?days=N — the caller's daily calories-burned window for the
 * "protein ↔ burn" chart. Lazily refreshes TDEE (best-effort): if the user has
 * metrics and the last compute is stale (>ENERGY_REFRESH_DAYS), recompute from
 * their weekly-average weight via Gemini and backfill the window. Never fails
 * the request on a Gemini/quota hiccup — it just returns what it has.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  const days = clampDays(Number(request.nextUrl.searchParams.get('days')));
  // `?force=1` recomputes TDEE even if not stale (used by the card's manual
  // "Recalculate" button, e.g. right after the estimate policy changes).
  const force = request.nextUrl.searchParams.get('force') === '1';

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('height_cm, birth_date, gender, tdee_updated_at')
    .eq('user_id', user.id)
    .single();

  if (profileErr) {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }

  const metrics = profile as ProfileRow;
  const hasMetrics = !!(metrics.height_cm && metrics.birth_date && metrics.gender);

  // ---- Lazy, throttled TDEE refresh + daily baseline materialization ------
  const keys = recentDayKeys(days);
  const from = keys[0];
  const to = keys[keys.length - 1];

  if (hasMetrics) {
    const stale =
      !metrics.tdee_updated_at ||
      Date.now() - new Date(metrics.tdee_updated_at).getTime() >= ENERGY_REFRESH_DAYS * DAY_MS;

    if (stale || force) {
      await maybeRefreshTdee(supabase, user.id, metrics);
    }

    // The weekly Gemini refresh only backfills the window at refresh time, so
    // days that have since rolled past (today included) would otherwise read as
    // 0 burned / "no baseline" until the next refresh — making it look like the
    // TDEE needs recalculating every day. Fill those gaps with the current
    // baseline: a plain DB copy, no Gemini, no quota. The estimate itself still
    // only changes via the weekly (or manual `?force=1`) refresh.
    await ensureWindowBaseline(supabase, user.id, keys);
  }

  // ---- Read the window -----------------------------------------------------
  const { data: rows, error } = await supabase
    .from('energy_logs')
    .select('date, bmr, tdee, gym_calories')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load burn data' }, { status: 500 });
  }

  // Zero-fill missing days with their TDEE baseline contribution (0 when none).
  const byDate = new Map((rows ?? []).map((r) => [r.date, toEnergyDay(r as EnergyRow)]));
  const dayRows = keys.map((k) => byDate.get(k) ?? { date: k, bmr: null, tdee: null, gym_calories: 0, total_burned: 0 });

  return NextResponse.json({
    hasMetrics,
    tdeeUpdatedAt: profile.tdee_updated_at,
    days: dayRows,
  });
}

/**
 * Best-effort weekly TDEE recompute. No-op (silently) when there's no weight
 * history, the quota is spent, or Gemini errors — the caller keeps old data.
 */
async function maybeRefreshTdee(
  supabase: SupabaseClient,
  userId: string,
  metrics: ProfileRow,
): Promise<void> {
  const heightCm = Number(metrics.height_cm);
  const gender = metrics.gender as 'male' | 'female';
  const birth_date = metrics.birth_date as string;

  // Weekly average weight over the last 7 days (need at least one entry).
  const since = dayKey(new Date(Date.now() - 7 * DAY_MS));
  const { data: weights } = await supabase
    .from('weight_logs')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .gte('date', since);

  if (!weights || weights.length === 0) return;
  const avgWeight =
    weights.reduce((s: number, w: { weight_kg: number | string }) => s + Number(w.weight_kg), 0) /
    weights.length;

  // Consume quota like any other Gemini call; defer if the daily limit is hit.
  const { data: quotaData } = await supabase.rpc('increment_quota_if_within_limit', {
    p_user_id: userId,
  });
  const quota = Array.isArray(quotaData) ? (quotaData[0] as { allowed?: boolean } | undefined) : undefined;
  if (!quota?.allowed) return;

  let bmr: number;
  let tdee: number;
  try {
    const est = await estimateEnergy({
      ageYears: ageYears(birth_date),
      gender,
      heightCm,
      weightKg: avgWeight,
    });
    bmr = est.bmr;
    tdee = est.tdee;
  } catch {
    return; // best-effort — keep the last good estimate
  }

  // Backfill the recent window with the new baseline, preserving any gym
  // calories already logged for those days.
  const keys = recentDayKeys(ENERGY_REFRESH_DAYS);
  const { data: existing } = await supabase
    .from('energy_logs')
    .select('date, gym_calories')
    .eq('user_id', userId)
    .gte('date', keys[0])
    .lte('date', keys[keys.length - 1]);

  const gymByDate = new Map((existing ?? []).map((e: { date: string; gym_calories: number }) => [e.date, Number(e.gym_calories) || 0]));

  const rows = keys.map((date) => ({
    user_id: userId,
    date,
    bmr,
    tdee,
    gym_calories: gymByDate.get(date) ?? 0,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from('energy_logs').upsert(rows, { onConflict: 'user_id,date' });

  await supabase
    .from('profiles')
    .update({ tdee_updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/**
 * Fills any day in `keys` that lacks a TDEE baseline with the most recent
 * estimate, preserving already-logged gym calories. No Gemini call. This is what
 * rolls the baseline forward daily between the weekly refreshes so today always
 * shows its TDEE + gym; it's a no-op right after a refresh (the window is already
 * covered) and whenever there's no baseline to copy yet.
 */
async function ensureWindowBaseline(
  supabase: SupabaseClient,
  userId: string,
  keys: string[],
): Promise<void> {
  // Most recent known baseline — the value we copy forward between refreshes.
  const { data: latest } = await supabase
    .from('energy_logs')
    .select('date, tdee')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const baseline = latest?.tdee != null ? Number(latest.tdee) : null;
  if (baseline == null) return; // no baseline yet — the "no baseline" state is accurate

  const { data: rows } = await supabase
    .from('energy_logs')
    .select('date, tdee, gym_calories')
    .eq('user_id', userId)
    .gte('date', keys[0])
    .lte('date', keys[keys.length - 1]);

  const byDate = new Map(
    (rows ?? []).map((r: { date: string; tdee: number | null; gym_calories: number | null }) => [
      r.date,
      r,
    ]),
  );

  const upserts: Record<string, unknown>[] = [];
  for (const date of keys) {
    const row = byDate.get(date);
    if (row && row.tdee != null) continue; // already has a baseline
    upserts.push({
      user_id: userId,
      date,
      tdee: baseline,
      gym_calories: row ? Number(row.gym_calories) || 0 : 0,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length) {
    await supabase.from('energy_logs').upsert(upserts, { onConflict: 'user_id,date' });
  }
}

/**
 * POST /api/burn — log today's gym calories on top of the TDEE baseline.
 * Plain number, no Gemini call.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: { gym_calories?: unknown };
  try {
    body = (await request.json()) as { gym_calories?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const value = Number(body.gym_calories);
  if (!Number.isFinite(value) || value < 0 || value > MAX_GYM_CALORIES) {
    return NextResponse.json(
      { error: `Gym calories must be between 0 and ${MAX_GYM_CALORIES}` },
      { status: 400 },
    );
  }

  const today = dayKey(new Date());
  const gym = Math.round(value);

  // Prefer an existing TDEE for today; otherwise fall back to the most recent.
  const { data: todayRow } = await supabase
    .from('energy_logs')
    .select('date, bmr, tdee')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  let saved: EnergyRow;
  if (todayRow) {
    const { data, error } = await supabase
      .from('energy_logs')
      .update({ gym_calories: gym, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', today)
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to save gym calories' }, { status: 500 });
    }
    saved = data as EnergyRow;
  } else {
    const { data: latest } = await supabase
      .from('energy_logs')
      .select('tdee')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const tdee = latest?.tdee ?? null;
    const { data, error } = await supabase
      .from('energy_logs')
      .insert({ user_id: user.id, date: today, tdee, gym_calories: gym })
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to save gym calories' }, { status: 500 });
    }
    saved = data as EnergyRow;
  }

  return NextResponse.json({ day: toEnergyDay(saved) }, { status: 201 });
}

export function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
