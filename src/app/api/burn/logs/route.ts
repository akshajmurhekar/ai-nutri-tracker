import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/burn/logs?days=N — the caller's gym-calorie entries (energy_logs
 * rows where gym_calories > 0) for the last N days, newest first. Used by the
 * History tab to show these alongside meals.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  // The burn dates are server (UTC) day keys; clamp like /api/meals.
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 30, 1), 90);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: entries, error } = await supabase
    .from('energy_logs')
    .select('date, gym_calories')
    .eq('user_id', user.id)
    .gt('gym_calories', 0)
    .gte('date', from)
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load burn entries' }, { status: 500 });
  }

  return NextResponse.json({
    entries: (entries ?? []).map((e) => ({ date: e.date, gym_calories: Number(e.gym_calories) })),
  });
}

/**
 * DELETE /api/burn/logs — removes a day's gym calories (sets them back to 0,
 * preserving the TDEE baseline). The burned total for that day reverts to TDEE.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: { date?: unknown };
  try {
    body = (await request.json()) as { date?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 });
  }

  const { error } = await supabase
    .from('energy_logs')
    .update({ gym_calories: 0, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('date', date);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove gym calories' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
