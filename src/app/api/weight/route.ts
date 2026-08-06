import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIN_KG = 20;
const MAX_KG = 400;

/**
 * GET /api/weight?days=N — returns the caller's weight history (default 90).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 90, 1), 365);
  const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: weights, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', fromIso.slice(0, 10))
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load weight history' }, { status: 500 });
  }

  return NextResponse.json({ weights: weights ?? [] });
}

/**
 * POST /api/weight — logs today's weight in kg. Re-logging the same day
 * overwrites that day's entry (upsert on user_id + date).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  let body: { weight_kg?: unknown };
  try {
    body = (await request.json()) as { weight_kg?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const value = Number(body.weight_kg);
  if (!Number.isFinite(value) || value < MIN_KG || value > MAX_KG) {
    return NextResponse.json({ error: `Weight must be a number between ${MIN_KG} and ${MAX_KG} kg` }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10); // today (server tz)

  const { data, error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: user.id, date, weight_kg: Math.round(value * 10) / 10 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to save weight' }, { status: 500 });
  }

  return NextResponse.json({ weight: data }, { status: 201 });
}
